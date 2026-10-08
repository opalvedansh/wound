import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { CaseCard, Page, PatientDetail, PatientListItem, StatusCounts } from '@antigravity-project-spec-pack/domain/api';
import type { ClinicContext } from '../auth/clinic.guard';
import { AuditService } from '../platform/audit.service';
import { CacheService } from '../platform/cache.service';
import { decodeCursor, encodeCursor, limitFrom, toPage } from '../platform/pagination';
import { optionalText, parse, pastDay, text } from '../platform/validation';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../visits/storage.service';
import { toCaseCard, toConsent, toPatientListItem } from '../views';

// Status is a filter (the chips), not a sort: stored status text doesn't sort by urgency.
const SORTS = ['recent', 'name', 'nextVisit', 'lastVisit'] as const;
type Sort = (typeof SORTS)[number];

export const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['overdue', 'review', 'healing', 'none']).optional(),
  sort: z.enum(SORTS).default('recent'),
  cursor: z.string().optional(),
  limit: z.unknown().optional(),
});

export const createPatient = z
  .object({
    patientId: z.string().trim().max(64).optional().transform((v) => (v ? v.toUpperCase() : null)),
    firstName: text(100),
    lastName: text(100),
    sex: z.enum(['M', 'F', 'O']),
    dateOfBirth: pastDay.optional(),
    ageYears: z.coerce.number().int().min(0).max(130).optional(),
    mobile: z.string().trim().regex(/^\+?[\d\s-]{7,20}$/).optional(),
    location: optionalText(200),
    referral: optionalText(200),
    notes: optionalText(2000),
    consent: z.object({
      care: z.literal(true),
      photos: z.boolean().default(true),
      location: z.boolean().default(false),
      aiTraining: z.boolean().default(false),
      noticeVersion: text(40),
    }),
  })
  .refine((p) => p.dateOfBirth || p.ageYears !== undefined, { path: ['dateOfBirth'], message: 'date of birth or age' });

export const updatePatient = z.object({
  firstName: text(100).optional(),
  lastName: text(100).optional(),
  sex: z.enum(['M', 'F', 'O']).optional(),
  dateOfBirth: pastDay.optional(),
  ageYears: z.coerce.number().int().min(0).max(130).optional(),
  mobile: z.string().trim().regex(/^\+?[\d\s-]{7,20}$/).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  referral: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const searchTextOf = (p: { firstName: string; lastName: string; patientId: string }) =>
  `${p.firstName} ${p.lastName} ${p.patientId}`.toLowerCase();

const listSelect = {
  id: true,
  patientId: true,
  firstName: true,
  lastName: true,
  sex: true,
  dateOfBirth: true,
  ageYears: true,
  status: true,
  lastVisitAt: true,
  nextVisitDue: true,
  createdAt: true,
  cases: { where: { deletedAt: null, closedAt: null }, orderBy: { createdAt: 'asc' }, take: 1, select: { woundType: true, location: true } },
  _count: { select: { cases: { where: { deletedAt: null, closedAt: null } } } },
} satisfies Prisma.PatientSelect;

const ORDER: Record<Exclude<Sort, 'recent'>, Prisma.PatientOrderByWithRelationInput[]> = {
  name: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
  nextVisit: [{ nextVisitDue: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  lastVisit: [{ lastVisitAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
};

/** Patients of the caller's clinic. Every query is scoped by clinicId and served by an index. */
@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(ctx: ClinicContext, raw: unknown): Promise<Page<PatientListItem>> {
    const query = parse(listQuery, raw);
    const limit = limitFrom(query.limit);
    const where: Prisma.PatientWhereInput = {
      clinicId: ctx.clinicId,
      deletedAt: null,
      // Trigram index on searchText makes this fast even on millions of rows.
      ...(query.q ? { searchText: { contains: query.q.toLowerCase() } } : {}),
      ...(query.status ? { status: query.status === 'none' ? null : query.status } : {}),
    };
    const cursor = decodeCursor(query.cursor);

    if (query.sort === 'recent') {
      // Keyset pagination on (createdAt, id): constant cost however deep the page.
      const after: Prisma.PatientWhereInput = cursor
        ? { OR: [{ createdAt: { lt: new Date(String(cursor.v)) } }, { createdAt: new Date(String(cursor.v)), id: { lt: cursor.id } }] }
        : {};
      const rows = await this.prisma.patient.findMany({
        where: { AND: [where, after] },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: listSelect,
      });
      const page = toPage(rows, limit, (r) => r.createdAt.toISOString());
      return { items: page.items.map(toPatientListItem), nextCursor: page.nextCursor };
    }

    // Other sorts page by offset (users rarely go deep in a sorted list); the cursor carries the offset.
    const offset = cursor ? Number(cursor.v) || 0 : 0;
    const rows = await this.prisma.patient.findMany({ where, orderBy: ORDER[query.sort], skip: offset, take: limit + 1, select: listSelect });
    return {
      items: rows.slice(0, limit).map(toPatientListItem),
      nextCursor: rows.length > limit ? encodeCursor({ v: offset + limit, id: 'offset' }) : null,
    };
  }

  /** Counts for the status chips, cached until the next write in the clinic. */
  counts(ctx: ClinicContext): Promise<StatusCounts> {
    return this.cache.clinic(ctx.clinicId, 'patient-counts', 60, async () => {
      const groups = await this.prisma.patient.groupBy({
        by: ['status'],
        where: { clinicId: ctx.clinicId, deletedAt: null },
        _count: { _all: true },
      });
      const of = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
      return { all: groups.reduce((n, g) => n + g._count._all, 0), overdue: of('overdue'), review: of('review'), healing: of('healing') };
    });
  }

  async get(ctx: ClinicContext, id: string): Promise<PatientDetail> {
    // The patient and their wounds load together (both clinic-scoped); the wounds are dropped if the patient isn't found.
    const [p, rows] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id, clinicId: ctx.clinicId, deletedAt: null },
        select: {
          ...listSelect,
          mobile: true,
          location: true,
          referral: true,
          notes: true,
          consent: true,
        },
      }),
      ctx.role === 'FRONT_DESK'
        ? Promise.resolve(null)
        : this.prisma.case.findMany({
            where: { patientId: id, clinicId: ctx.clinicId, deletedAt: null },
            orderBy: [{ closedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
          }),
    ]);
    if (!p) throw new NotFoundException('Patient not found.');

    let cases: CaseCard[] | null = null;
    if (rows) {
      const latest = await this.latestPhotos(rows.map((r) => r.latestResultId).filter((x): x is string => !!x));
      cases = rows.map((c) => {
        const photo = c.latestResultId ? latest.get(c.latestResultId) : undefined;
        return toCaseCard(c, photo?.url ?? null, photo?.outline ?? null);
      });
    }
    return {
      ...toPatientListItem(p),
      mobile: p.mobile,
      location: p.location,
      referral: p.referral,
      notes: p.notes,
      consent: toConsent(p.consent),
      cases,
    };
  }

  /** Thumbnail URL and outline of each result, for wound cards. */
  async latestPhotos(resultIds: string[]) {
    if (resultIds.length === 0) return new Map<string, { url: string | null; outline: CaseCard['outline'] }>();
    const results = await this.prisma.aIResult.findMany({
      where: { id: { in: resultIds } },
      select: { id: true, findings: true, phase: { select: { image: { select: { imageUrl: true, thumbPath: true } } } } },
    });
    const paths = results.map((r) => r.phase.image?.thumbPath ?? r.phase.image?.imageUrl ?? '').filter(Boolean);
    const urls = await this.storage.signedUrls(paths);
    return new Map(
      results.map((r) => {
        const path = r.phase.image?.thumbPath ?? r.phase.image?.imageUrl;
        const outline = ((r.findings as { outline?: CaseCard['outline'] } | null)?.outline ?? null) as CaseCard['outline'];
        return [r.id, { url: path ? urls.get(path) ?? null : null, outline }];
      }),
    );
  }

  async create(ctx: ClinicContext, raw: unknown): Promise<PatientDetail> {
    const input = parse(createPatient, raw, 'Check the patient details.');
    const consent = { ...input.consent, recordedAt: new Date().toISOString() };
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Codes come from a per-clinic counter, incremented atomically, so two registrations never collide.
        let code = input.patientId;
        if (!code) {
          const clinic = await tx.clinic.update({ where: { id: ctx.clinicId }, data: { patientSeq: { increment: 1 } }, select: { patientSeq: true } });
          code = `WM-${String(clinic.patientSeq).padStart(4, '0')}`;
        }
        return tx.patient.create({
          data: {
            clinicId: ctx.clinicId,
            createdById: ctx.userId,
            patientId: code,
            firstName: input.firstName,
            lastName: input.lastName,
            sex: input.sex,
            dateOfBirth: input.dateOfBirth ?? null,
            ageYears: input.ageYears ?? null,
            mobile: input.mobile ?? null,
            location: input.location,
            referral: input.referral,
            notes: input.notes,
            consent,
            searchText: searchTextOf({ firstName: input.firstName, lastName: input.lastName, patientId: code }),
          },
          select: { id: true },
        });
      });
      await Promise.all([
        this.cache.bump(ctx.clinicId),
        this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'patient.create', entity: 'Patient', entityId: created.id }),
      ]);
      return this.get(ctx, created.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ message: 'This patient ID is already registered in your clinic.', problems: ['patientId'] });
      }
      throw error;
    }
  }

  async update(ctx: ClinicContext, id: string, raw: unknown): Promise<PatientDetail> {
    const input = parse(updatePatient, raw);
    const current = await this.prisma.patient.findFirst({ where: { id, clinicId: ctx.clinicId, deletedAt: null } });
    if (!current) throw new NotFoundException('Patient not found.');
    const next = { ...current, ...input };
    await this.prisma.patient.update({
      where: { id },
      data: { ...input, searchText: searchTextOf(next), version: { increment: 1 } },
    });
    await Promise.all([
      this.cache.bump(ctx.clinicId),
      this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'patient.update', entity: 'Patient', entityId: id, details: { fields: Object.keys(input) } }),
    ]);
    return this.get(ctx, id);
  }

  /**
   * Deletes a patient: photos and analysis results go at once; the patient, wounds and visits stay as tombstones
   * (deletedAt) so the mobile app learns of the delete on its next sync, and are purged later.
   */
  async remove(ctx: ClinicContext, id: string): Promise<void> {
    const patient = await this.prisma.patient.findFirst({ where: { id, clinicId: ctx.clinicId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient not found.');
    const images = await this.prisma.image.findMany({
      where: { phase: { treatment: { case: { patientId: id } } } },
      select: { imageUrl: true, thumbPath: true },
    });
    const now = new Date();
    const inPatient = { phase: { treatment: { case: { patientId: id } } } };
    await this.prisma.$transaction([
      this.prisma.aIResult.deleteMany({ where: inPatient }),
      this.prisma.image.deleteMany({ where: inPatient }),
      this.prisma.clinicalAssessment.deleteMany({ where: inPatient }),
      this.prisma.phase.updateMany({ where: { treatment: { case: { patientId: id } } }, data: { deletedAt: now, version: { increment: 1 } } }),
      this.prisma.treatment.updateMany({ where: { case: { patientId: id } }, data: { deletedAt: now, version: { increment: 1 } } }),
      this.prisma.case.updateMany({ where: { patientId: id }, data: { deletedAt: now, version: { increment: 1 } } }),
      this.prisma.patient.update({ where: { id }, data: { deletedAt: now, version: { increment: 1 } } }),
    ]);
    await this.storage.remove(images.flatMap((i) => [i.imageUrl, i.thumbPath ?? '']));
    await Promise.all([
      this.cache.bump(ctx.clinicId),
      this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'patient.delete', entity: 'Patient', entityId: id, details: { photos: images.length } }),
    ]);
  }
}
