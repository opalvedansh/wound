import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  filterIntake,
  missingIntake,
  previousMeasurement,
  type CaseView,
  type IntakeAnswers,
  type IntakeQuestion,
  type Overview,
  type QueueItem,
  type ReviewView,
  type VisitOutcome,
} from '@antigravity-project-spec-pack/domain/wound-model';
import type { AuthUser } from '../auth/supabase-auth.guard';
import type { ReviewInput } from '../inputs';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users.service';
import { toCaseSummary, toReviewView, toVisitView } from '../views';
import { ModelClient } from './model-client';
import { StorageService } from './storage.service';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // the model service's own limit

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

/**
 * A visit is one analysed photo of a wound: a Treatment with its pre-treatment Phase, the photo (Image) and the
 * model's findings (AIResult), the same shape the mobile app uses. A clinician then approves, edits or rejects
 * the draft (AIReview). Every query is scoped to the signed-in user's own patients; anything else is a 404.
 */
@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly model: ModelClient,
    private readonly storage: StorageService,
    private readonly users: UsersService,
  ) {}

  intakeQuestions(): Promise<IntakeQuestion[]> {
    return this.model.questions();
  }

  async followUps(raw: unknown): Promise<IntakeQuestion[]> {
    const answers = parseAnswers(raw);
    return this.model.followUps(filterIntake(answers, await this.model.questions()));
  }

  async caseView(user: AuthUser, caseId: string): Promise<CaseView> {
    const found = await this.prisma.case.findFirst({
      where: { id: caseId, patient: { userId: user.id } },
      include: {
        patient: true,
        treatments: {
          orderBy: { createdAt: 'asc' },
          include: { phases: { include: { image: true, aiResult: { include: { review: true } } } } },
        },
      },
    });
    if (!found) throw new NotFoundException('Case not found.');

    const analysed = found.treatments.flatMap((t) =>
      t.phases.filter((p) => p.aiResult).map((p) => ({ treatmentId: t.id, path: p.image?.imageUrl ?? null, result: p.aiResult! })),
    );
    const urls = await this.storage.signedUrls(analysed.flatMap((v) => (v.path ? [v.path] : [])));
    return {
      ...toCaseSummary(found),
      comorbidities: found.comorbidities,
      patient: {
        id: found.patient.id,
        firstName: found.patient.firstName,
        lastName: found.patient.lastName,
        patientId: found.patient.patientId,
      },
      visits: analysed.map((v) => toVisitView(v.treatmentId, v.result, v.path ? urls.get(v.path) ?? null : null)),
    };
  }

  async create(user: AuthUser, caseId: string, photo: PhotoUpload | undefined, rawAnswers: unknown): Promise<VisitOutcome> {
    const woundCase = await this.prisma.case.findFirst({
      where: { id: caseId, patient: { userId: user.id } },
      include: { treatments: { include: { phases: { include: { aiResult: true } } } } },
    });
    if (!woundCase) throw new NotFoundException('Case not found.');

    if (!photo) throw new BadRequestException('Add a photo of the wound.');
    if (photo.size > MAX_PHOTO_BYTES) throw new PayloadTooLargeException('The photo is larger than 15 MB.');
    const type = imageType(photo.buffer);
    if (!type) throw new BadRequestException('The photo must be a JPEG or PNG image.');

    const answers = parseAnswers(rawAnswers);
    const missing = missingIntake(answers as IntakeAnswers);
    if (missing.length) throw new BadRequestException({ message: 'Answer the required questions.', problems: missing });

    // Only the model's own choice and number questions (core + the follow-ups these answers unlock) are sent.
    const core = await this.model.questions();
    const followUps = await this.model.followUps(filterIntake(answers, core));
    const intake = filterIntake(answers, [...core, ...followUps]);

    const earlier = woundCase.treatments.flatMap((t) => t.phases.flatMap((p) => (p.aiResult ? [p.aiResult] : [])));
    const findings = await this.model.analyze({ buffer: photo.buffer, mimetype: type }, intake, previousMeasurement(earlier));

    // A photo the model can't use is never stored: the clinician retakes it.
    if (findings.status !== 'ok') {
      return { status: findings.status, issues: findings.quality?.issues ?? [], flags: findings.flags ?? [] };
    }

    const treatmentId = randomUUID();
    const phaseId = `${treatmentId}-PRE`;
    const path = `treatments/${treatmentId}/pre.${type === 'image/png' ? 'png' : 'jpg'}`;
    const m = findings.measurement ?? null;

    await this.storage.upload(path, photo.buffer, type);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.treatment.create({ data: { id: treatmentId, caseId, therapy: [] } });
        await tx.phase.create({ data: { id: phaseId, treatmentId, phaseType: 'PRE' } });
        await tx.image.create({ data: { phaseId, imageUrl: path } });
        return tx.aIResult.create({
          data: {
            phaseId,
            area: m?.area_cm2 ?? null,
            length: m?.length_cm ?? null,
            height: m?.width_cm ?? null,
            confidenceScore: findings.wound_type?.prob ?? null,
            findings: findings as unknown as Prisma.InputJsonValue,
            intake: intake as Prisma.InputJsonValue,
            draftReport: findings.report_markdown ?? null,
            modelVersions: (findings.model_versions ?? undefined) as Prisma.InputJsonValue | undefined,
            modelCaseId: findings.case_id ?? null,
          },
        });
      });
      const urls = await this.storage.signedUrls([path]);
      return { status: 'ok', visit: toVisitView(treatmentId, { ...result, review: null }, urls.get(path) ?? null) };
    } catch (error) {
      await this.storage.remove(path);
      throw error;
    }
  }

  async overview(user: AuthUser, now = new Date()): Promise<Overview> {
    const mine = { patient: { userId: user.id } };
    const [patients, openWounds, results] = await Promise.all([
      this.prisma.patient.count({ where: { userId: user.id } }),
      this.prisma.case.count({ where: mine }),
      this.prisma.aIResult.findMany({
        where: { phase: { treatment: { case: mine } } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          area: true,
          findings: true,
          review: { select: { id: true } },
          phase: { select: { treatment: { select: { case: { select: { id: true, location: true, patient: true } } } } } },
        },
      }),
    ]);
    const weekAgo = now.getTime() - 7 * 86_400_000;
    const queue: QueueItem[] = results
      .filter((r) => !r.review)
      .map((r) => {
        const flags = ((r.findings as { flags?: { level: string }[] } | null)?.flags ?? []);
        const c = r.phase.treatment.case;
        return {
          aiResultId: r.id,
          caseId: c.id,
          caseLocation: c.location,
          patient: { id: c.patient.id, firstName: c.patient.firstName, lastName: c.patient.lastName, patientId: c.patient.patientId },
          takenAt: r.createdAt.toISOString(),
          urgentFlags: flags.filter((f) => f.level === 'urgent').length,
          reviewFlags: flags.filter((f) => f.level === 'review').length,
          areaCm2: r.area,
        };
      })
      // Urgent first, then newest (the list is already newest first and sort is stable).
      .sort((a, b) => Number(b.urgentFlags > 0) - Number(a.urgentFlags > 0));
    return {
      patients,
      openWounds,
      visitsThisWeek: results.filter((r) => r.createdAt.getTime() >= weekAgo).length,
      awaitingReview: queue.length,
      urgentAwaitingReview: queue.filter((q) => q.urgentFlags > 0).length,
      queue,
    };
  }

  /** Deletes a visit (its treatment, phases, results, review) and then its photos. */
  async removeVisit(user: AuthUser, aiResultId: string): Promise<void> {
    const result = await this.prisma.aIResult.findFirst({
      where: { id: aiResultId, phase: { treatment: { case: { patient: { userId: user.id } } } } },
      include: { phase: { include: { treatment: { include: { phases: { include: { image: true } } } } } } },
    });
    if (!result) throw new NotFoundException('Result not found.');
    const treatmentId = result.phase.treatmentId;
    const paths = result.phase.treatment.phases.flatMap((p) => (p.image ? [p.image.imageUrl] : []));
    const inTreatment = { phase: { treatmentId } };
    await this.prisma.$transaction([
      this.prisma.aIReview.deleteMany({ where: { aiResult: inTreatment } }),
      this.prisma.aIResult.deleteMany({ where: inTreatment }),
      this.prisma.image.deleteMany({ where: inTreatment }),
      this.prisma.clinicalAssessment.deleteMany({ where: inTreatment }),
      this.prisma.phase.deleteMany({ where: { treatmentId } }),
      this.prisma.treatment.delete({ where: { id: treatmentId } }),
    ]);
    await this.storage.remove(paths);
  }

  /** Deletes a patient with every wound, visit and photo. */
  async removePatient(user: AuthUser, patientId: string): Promise<void> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, userId: user.id },
      include: { cases: { include: { treatments: { include: { phases: { include: { image: true } } } } } } },
    });
    if (!patient) throw new NotFoundException('Patient not found.');
    const paths = patient.cases.flatMap((c) => c.treatments.flatMap((t) => t.phases.flatMap((p) => (p.image ? [p.image.imageUrl] : []))));
    const inPatient = { phase: { treatment: { case: { patientId } } } };
    await this.prisma.$transaction([
      this.prisma.aIReview.deleteMany({ where: { aiResult: inPatient } }),
      this.prisma.aIResult.deleteMany({ where: inPatient }),
      this.prisma.image.deleteMany({ where: inPatient }),
      this.prisma.clinicalAssessment.deleteMany({ where: inPatient }),
      this.prisma.phase.deleteMany({ where: { treatment: { case: { patientId } } } }),
      this.prisma.treatment.deleteMany({ where: { case: { patientId } } }),
      this.prisma.case.deleteMany({ where: { patientId } }),
      this.prisma.patient.delete({ where: { id: patientId } }),
    ]);
    await this.storage.remove(paths);
  }

  async review(user: AuthUser, aiResultId: string, input: ReviewInput): Promise<ReviewView> {
    const result = await this.prisma.aIResult.findFirst({
      where: { id: aiResultId, phase: { treatment: { case: { patient: { userId: user.id } } } } },
      include: { review: true },
    });
    if (!result) throw new NotFoundException('Result not found.');
    if (result.review) throw new ConflictException('This draft has already been reviewed.');

    await this.users.ensure(user);
    // Approving keeps the draft as the final text; editing stores the clinician's version.
    const finalReport = input.decision === 'approved' ? result.draftReport : input.decision === 'edited' ? input.finalReport : null;
    let review;
    try {
      review = await this.prisma.aIReview.create({
        data: {
          aiResultId,
          reviewerId: user.id,
          decision: input.decision,
          finalReport,
          reason: input.decision === 'rejected' ? input.reason : null,
          corrections: (input.corrections ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This draft has already been reviewed.');
      }
      throw error;
    }

    if (result.modelCaseId) {
      // The model service only sees an opaque user id, never a name or email.
      await this.model.review({
        case_id: result.modelCaseId,
        reviewer_id: user.id,
        decision: input.decision,
        final_summary: finalReport,
        corrections: input.corrections,
      });
    }
    return toReviewView(review);
  }
}
