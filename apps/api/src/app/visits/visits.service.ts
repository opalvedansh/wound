import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { z } from 'zod';
import {
  filterIntake,
  missingIntake,
  type AnalyzeResponse,
  type IntakeAnswers,
  type IntakeQuestion,
} from '@antigravity-project-spec-pack/domain/wound-model';
import type { ReviewView, VisitView } from '@antigravity-project-spec-pack/domain/api';
import type { ClinicContext } from '../auth/clinic.guard';
import { SummaryService } from '../cases/summary.service';
import { AuditService } from '../platform/audit.service';
import { CacheService } from '../platform/cache.service';
import { JobsService, type JobMeta } from '../platform/jobs.service';
import { parse } from '../platform/validation';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users.service';
import { toReviewView, toVisitView, visitPaths, visitSelect } from '../views';
import { ModelClient } from './model-client';
import { StorageService } from './storage.service';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // the model service's own limit
const THUMB_WIDTH = 320;
const DAY_MS = 86_400_000;

/** The parts of a multer upload the service reads. */
export interface PhotoUpload {
  buffer: Buffer;
  size: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The photo's real type from its first bytes; the file name and declared type can't be trusted. */
export const imageType = (bytes: Buffer): 'image/jpeg' | 'image/png' | null => {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  return null;
};

const parseAnswers = (raw: unknown): Record<string, unknown> => {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = undefined;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Send the answers as a JSON object.');
  return value as Record<string, unknown>;
};

export const reviewInput = z
  .object({
    decision: z.enum(['approved', 'edited', 'rejected']),
    finalReport: z.string().trim().max(20000).optional(),
    reason: z.string().trim().max(2000).optional(),
    corrections: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((r) => r.decision !== 'edited' || !!r.finalReport, { path: ['finalReport'], message: 'required' })
  .refine((r) => r.decision !== 'rejected' || !!r.reason, { path: ['reason'], message: 'required' });

/**
 * A visit is one analysed photo of a wound: a Treatment (T1, T2…) with its pre-treatment Phase, the photo (Image)
 * and the model's findings (AIResult). Analysis runs in the background: creating a visit returns at once with
 * status `processing`, and clients poll GET /visits/:id. A clinician then approves, edits or rejects the draft.
 */
@Injectable()
export class VisitsService implements OnModuleInit {
  private readonly logger = new Logger(VisitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly model: ModelClient,
    private readonly storage: StorageService,
    private readonly users: UsersService,
    private readonly jobs: JobsService,
    private readonly summary: SummaryService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.jobs.handle('analyze-visit', (data, meta) => this.analyze(String(data['visitId']), meta));
    this.jobs.handle('thumbnail', (data) => this.thumbnail(String(data['visitId'])));
    this.jobs.handle('forward-review', (data) => this.forwardReview(String(data['visitId'])));
    this.jobs.handle('purge', () => this.purge());
  }

  intakeQuestions(): Promise<IntakeQuestion[]> {
    return this.model.questions();
  }

  async followUps(raw: unknown): Promise<IntakeQuestion[]> {
    const answers = parseAnswers(raw);
    return this.model.followUps(filterIntake(answers, await this.model.questions()));
  }

  private async view(ctx: ClinicContext, id: string): Promise<VisitView> {
    const row = await this.prisma.aIResult.findFirst({ where: { id, clinicId: ctx.clinicId }, select: visitSelect });
    if (!row) throw new NotFoundException('Visit not found.');
    const urls = await this.storage.signedUrls(visitPaths([row]));
    return toVisitView(row, urls);
  }

  get(ctx: ClinicContext, id: string): Promise<VisitView> {
    return this.view(ctx, id);
  }

  async create(ctx: ClinicContext, caseId: string, photo: PhotoUpload | undefined, rawAnswers: unknown): Promise<VisitView> {
    const woundCase = await this.prisma.case.findFirst({
      where: { id: caseId, clinicId: ctx.clinicId, deletedAt: null },
      select: { id: true, patientId: true },
    });
    if (!woundCase) throw new NotFoundException('Wound not found.');
    if (!photo) throw new BadRequestException('Add a photo of the wound.');
    if (photo.size > MAX_PHOTO_BYTES) throw new PayloadTooLargeException('The photo is larger than 15 MB.');
    const type = imageType(photo.buffer);
    if (!type) throw new BadRequestException('The photo must be a JPEG or PNG image.');

    const answers = parseAnswers(rawAnswers);
    const missing = missingIntake(answers as IntakeAnswers);
    if (missing.length) throw new BadRequestException({ message: 'Answer the required questions.', problems: missing });
    // Only the model's own choice and number questions (core + the follow-ups these answers unlock) are kept:
    // free text could carry identifying details.
    const core = await this.model.questions();
    const followUps = await this.model.followUps(filterIntake(answers, core));
    const intake = filterIntake(answers, [...core, ...followUps]);

    const treatmentId = randomUUID();
    const phaseId = randomUUID();
    const path = `${ctx.clinicId}/treatments/${treatmentId}/pre.${type === 'image/png' ? 'png' : 'jpg'}`;
    await this.storage.upload(path, photo.buffer, type);
    let visitId: string;
    try {
      visitId = await this.prisma.$transaction(async (tx) => {
        const last = await tx.treatment.findFirst({ where: { caseId }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
        await tx.treatment.create({ data: { id: treatmentId, clinicId: ctx.clinicId, caseId, sequence: (last?.sequence ?? 0) + 1, therapy: [] } });
        await tx.phase.create({ data: { id: phaseId, clinicId: ctx.clinicId, treatmentId, phaseType: 'PRE' } });
        await tx.image.create({ data: { phaseId, imageUrl: path } });
        const result = await tx.aIResult.create({
          data: { clinicId: ctx.clinicId, phaseId, status: 'processing', intake: intake as Prisma.InputJsonValue },
          select: { id: true },
        });
        return result.id;
      });
    } catch (error) {
      await this.storage.remove(path);
      throw error;
    }
    await this.jobs.enqueue('analyze-visit', { visitId }, { jobId: `analyze-${visitId}` });
    await this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'visit.create', entity: 'AIResult', entityId: visitId });
    return this.view(ctx, visitId);
  }

  /** Runs a failed analysis again (e.g. the model was asleep or down). */
  async retry(ctx: ClinicContext, id: string): Promise<VisitView> {
    const row = await this.prisma.aIResult.findFirst({ where: { id, clinicId: ctx.clinicId }, select: { status: true } });
    if (!row) throw new NotFoundException('Visit not found.');
    if (row.status !== 'failed') throw new ConflictException('Only a failed analysis can be retried.');
    await this.prisma.aIResult.update({ where: { id }, data: { status: 'processing', error: null } });
    await this.jobs.enqueue('analyze-visit', { visitId: id }, { jobId: `analyze-${id}-${Date.now()}` });
    return this.view(ctx, id);
  }

  /** Background job: the model analyses the stored photo. */
  async analyze(visitId: string, meta: JobMeta = { final: true }): Promise<void> {
    const row = await this.prisma.aIResult.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        status: true,
        intake: true,
        phase: { select: { id: true, image: { select: { imageUrl: true } }, treatment: { select: { caseId: true, case: { select: { latestAreaCm2: true, lastVisitAt: true } } } } } },
      },
    });
    if (!row || row.status !== 'processing' || !row.phase.image) return;
    const path = row.phase.image.imageUrl;
    const { case: c, caseId } = row.phase.treatment;
    // The case summary still describes the visits before this one: exactly what "previous" means.
    const previous =
      c.latestAreaCm2 && c.lastVisitAt
        ? { area_cm2: c.latestAreaCm2, days_ago: Math.max(0, Math.round((Date.now() - c.lastVisitAt.getTime()) / DAY_MS)) }
        : undefined;

    let findings: AnalyzeResponse;
    try {
      const photo = await this.storage.download(path);
      findings = await this.model.analyze({ buffer: photo, mimetype: path.endsWith('.png') ? 'image/png' : 'image/jpeg' }, row.intake as IntakeAnswers, previous);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Let the queue retry; after the last attempt the visit shows as failed with a Retry button.
      await this.prisma.aIResult.update({
        where: { id: visitId },
        data: { error: message.slice(0, 300), ...(meta.final ? { status: 'failed' } : {}) },
      });
      if (meta.final) return;
      throw error;
    }

    if (findings.status !== 'ok') {
      // A photo the model can't use is never kept: the clinician retakes it.
      await this.prisma.$transaction([
        this.prisma.aIResult.update({ where: { id: visitId }, data: { status: findings.status, findings: findings as unknown as Prisma.InputJsonValue } }),
        this.prisma.image.deleteMany({ where: { phaseId: row.phase.id } }),
      ]);
      await this.storage.remove(path);
      return;
    }

    const m = findings.measurement ?? null;
    const flags = findings.flags ?? [];
    await this.prisma.aIResult.update({
      where: { id: visitId },
      data: {
        status: 'ok',
        error: null,
        area: m?.area_cm2 ?? null,
        length: m?.length_cm ?? null,
        height: m?.width_cm ?? null,
        confidenceScore: findings.wound_type?.prob ?? null,
        findings: findings as unknown as Prisma.InputJsonValue,
        draftReport: findings.report_markdown ?? null,
        modelVersions: (findings.model_versions ?? undefined) as Prisma.InputJsonValue | undefined,
        modelCaseId: findings.case_id ?? null,
        urgent: flags.some((f) => f.level === 'urgent'),
        flagCount: flags.length,
      },
    });
    await this.summary.refreshCase(caseId);
    await this.jobs.enqueue('thumbnail', { visitId });
  }

  /** Background job: a 320 px thumbnail for lists and cards (a fraction of the photo's size). */
  async thumbnail(visitId: string): Promise<void> {
    const row = await this.prisma.aIResult.findUnique({
      where: { id: visitId },
      select: { clinicId: true, phase: { select: { id: true, image: { select: { imageUrl: true, thumbPath: true } } } } },
    });
    const image = row?.phase.image;
    if (!row || !image || image.thumbPath) return;
    const photo = await this.storage.download(image.imageUrl);
    const thumb = await sharp(photo).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    const thumbPath = image.imageUrl.replace(/\.(jpg|png)$/, '.thumb.jpg');
    await this.storage.upload(thumbPath, thumb, 'image/jpeg');
    await this.prisma.image.update({ where: { phaseId: row.phase.id }, data: { thumbPath } });
    await this.cache.bump(row.clinicId);
  }

  async review(ctx: ClinicContext, id: string, raw: unknown): Promise<ReviewView> {
    const input = parse(reviewInput, raw, 'Check the review.');
    const result = await this.prisma.aIResult.findFirst({
      where: { id, clinicId: ctx.clinicId, status: 'ok' },
      select: { id: true, draftReport: true, review: { select: { id: true } } },
    });
    if (!result) throw new NotFoundException('Result not found.');
    if (result.review) throw new ConflictException('This draft has already been reviewed.');

    await this.users.ensure({ id: ctx.userId, email: ctx.email, role: null });
    const finalReport = input.decision === 'approved' ? result.draftReport : input.decision === 'edited' ? input.finalReport ?? null : null;
    let review;
    try {
      [review] = await this.prisma.$transaction([
        this.prisma.aIReview.create({
          data: {
            aiResultId: id,
            reviewerId: ctx.userId,
            decision: input.decision,
            finalReport,
            reason: input.decision === 'rejected' ? input.reason ?? null : null,
            corrections: (input.corrections ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        }),
        this.prisma.aIResult.update({ where: { id }, data: { reviewStatus: input.decision } }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This draft has already been reviewed.');
      }
      throw error;
    }
    // The model service hears about the decision in the background, never slowing the clinician down.
    await Promise.all([
      this.jobs.enqueue('forward-review', { visitId: id }),
      this.cache.bump(ctx.clinicId),
      this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'visit.review', entity: 'AIResult', entityId: id, details: { decision: input.decision } }),
    ]);
    return toReviewView(review);
  }

  async forwardReview(visitId: string): Promise<void> {
    const r = await this.prisma.aIResult.findUnique({ where: { id: visitId }, select: { modelCaseId: true, review: true } });
    if (!r?.modelCaseId || !r.review) return;
    await this.model.review({
      case_id: r.modelCaseId,
      reviewer_id: r.review.reviewerId, // an opaque id, never a name or email
      decision: r.review.decision as 'approved' | 'edited' | 'rejected',
      final_summary: r.review.finalReport,
      corrections: (r.review.corrections as Record<string, unknown> | null) ?? null,
    });
  }

  /** Deletes a visit: its result and photos at once; the treatment stays as a tombstone for the mobile app's sync. */
  async remove(ctx: ClinicContext, id: string): Promise<void> {
    const result = await this.prisma.aIResult.findFirst({
      where: { id, clinicId: ctx.clinicId },
      select: { phase: { select: { treatmentId: true, treatment: { select: { caseId: true } } } } },
    });
    if (!result) throw new NotFoundException('Visit not found.');
    const { treatmentId } = result.phase;
    const images = await this.prisma.image.findMany({ where: { phase: { treatmentId } }, select: { imageUrl: true, thumbPath: true } });
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.aIResult.deleteMany({ where: { phase: { treatmentId } } }),
      this.prisma.image.deleteMany({ where: { phase: { treatmentId } } }),
      this.prisma.clinicalAssessment.deleteMany({ where: { phase: { treatmentId } } }),
      this.prisma.phase.updateMany({ where: { treatmentId }, data: { deletedAt: now, version: { increment: 1 } } }),
      this.prisma.treatment.update({ where: { id: treatmentId }, data: { deletedAt: now, version: { increment: 1 } } }),
    ]);
    await this.storage.remove(images.flatMap((i) => [i.imageUrl, i.thumbPath ?? '']));
    await this.summary.refreshCase(result.phase.treatment.caseId);
    await this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'visit.delete', entity: 'AIResult', entityId: id, details: { photos: images.length } });
  }

  /** Daily job: retakes and abandoned visits after a day, tombstones after 30 days. */
  async purge(): Promise<void> {
    const dayAgo = new Date(Date.now() - DAY_MS);
    const monthAgo = new Date(Date.now() - 30 * DAY_MS);
    const stale = await this.prisma.aIResult.findMany({
      where: { status: { in: ['retake', 'no_wound_found'] }, createdAt: { lt: dayAgo } },
      select: { phase: { select: { treatmentId: true } } },
    });
    const treatmentIds = stale.map((s) => s.phase.treatmentId);
    if (treatmentIds.length) await this.prisma.treatment.deleteMany({ where: { id: { in: treatmentIds } } }); // cascades
    await this.prisma.$transaction([
      this.prisma.patient.deleteMany({ where: { deletedAt: { lt: monthAgo } } }),
      this.prisma.case.deleteMany({ where: { deletedAt: { lt: monthAgo } } }),
      this.prisma.treatment.deleteMany({ where: { deletedAt: { lt: monthAgo } } }),
    ]);
    this.logger.log(`Purged ${treatmentIds.length} retake visit(s) and old tombstones.`);
  }
}
