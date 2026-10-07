import { BadRequestException, ConflictException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import type { AnalyzeResponse, IntakeQuestion } from '@antigravity-project-spec-pack/domain/wound-model';
import type { AuthUser } from '../auth/supabase-auth.guard';
import type { PrismaService } from '../prisma.service';
import type { UsersService } from '../users.service';
import type { ModelClient } from './model-client';
import type { StorageService } from './storage.service';
import { MAX_PHOTO_BYTES, VisitsService } from './visits.service';

const user: AuthUser = { id: 'u1', role: null, email: 'dr@clinic.example' };
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const photo = { buffer: jpeg, size: jpeg.length };

const CORE: IntakeQuestion[] = [
  { id: 'body_location', text: 'Where?', type: 'choice', options: ['heel', 'toe'] },
  { id: 'cause', text: 'How?', type: 'choice', options: ['burn', 'unknown'] },
  { id: 'diabetes', text: 'Diabetes?', type: 'choice', options: ['yes', 'no'] },
  { id: 'pain', text: 'Pain?', type: 'number' },
  { id: 'current_treatment', text: 'Current dressing (free text)', type: 'text' },
];
const FOLLOW_UPS: IntakeQuestion[] = [{ id: 'burn_agent', text: 'Burn agent?', type: 'choice', options: ['flame', 'chemical'] }];

const ANSWERS = {
  diabetes: 'no',
  cause: 'burn',
  body_location: 'heel',
  pain: '4',
  burn_agent: 'chemical',
  current_treatment: "Foam dressing, Mrs Rao's",
  patient_name: 'Asha Rao',
};

const OK: AnalyzeResponse = {
  status: 'ok',
  case_id: 'model-case-1',
  flags: [{ level: 'review', text: 'Size not measured.' }],
  wound_type: { label: 'burn', prob: 0.86, top: [['burn', 0.86]] },
  measurement: { area_cm2: 4.2, length_cm: 3.1, width_cm: 1.8, perimeter_cm: 8.4, n_regions: 1 },
  report_markdown: '# Wound assessment (AI-assisted draft)',
  model_versions: { boundary: 'b1' },
};

const DAY = 86_400_000;

function setup(options: { findings?: AnalyzeResponse; transactionFails?: boolean; aiResult?: unknown } = {}) {
  const woundCase = {
    id: 'c1',
    ownerId: 'u1',
    treatments: [{ phases: [{ aiResult: { area: 5, createdAt: new Date(Date.now() - 7 * DAY) } }] }],
  };
  const created: Record<string, Record<string, unknown>[]> = { treatment: [], phase: [], image: [], aIResult: [] };
  const record = (table: string) => ({
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (table === 'aIResult' && options.transactionFails) throw new Error('database unavailable');
      const row = { id: `${table}-1`, createdAt: new Date('2026-10-08T10:00:00Z'), ...data };
      created[table].push(row);
      return row;
    }),
  });
  const tx = { treatment: record('treatment'), phase: record('phase'), image: record('image'), aIResult: record('aIResult') };
  const prisma = {
    case: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; patient: { userId: string } } }) =>
        where.id === woundCase.id && where.patient.userId === woundCase.ownerId ? woundCase : null,
      ),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    aIResult: { findFirst: jest.fn(async () => options.aiResult ?? null) },
    aIReview: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, createdAt: new Date('2026-10-08T11:00:00Z') })),
    },
  };
  const model = {
    questions: jest.fn(async () => CORE),
    followUps: jest.fn(async () => FOLLOW_UPS),
    analyze: jest.fn(async () => options.findings ?? OK),
    review: jest.fn(async () => undefined),
  };
  const storage = {
    upload: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    signedUrls: jest.fn(async (paths: string[]) => new Map(paths.map((p) => [p, `https://signed.example/${p}`]))),
  };
  const users = { ensure: jest.fn(async () => undefined) };
  const service = new VisitsService(
    prisma as unknown as PrismaService,
    model as unknown as ModelClient,
    storage as unknown as StorageService,
    users as unknown as UsersService,
  );
  return { service, prisma, model, storage, users, created };
}

describe('VisitsService.create', () => {
  it('stores nothing when the model asks for a retake', async () => {
    const { service, storage, prisma } = setup({
      findings: { status: 'retake', quality: { ok: false, issues: ['Photo looks blurry.'] } },
    });
    await expect(service.create(user, 'c1', photo, JSON.stringify(ANSWERS))).resolves.toEqual({
      status: 'retake',
      issues: ['Photo looks blurry.'],
      flags: [],
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("stores the photo and the model's findings as a visit", async () => {
    const { service, storage, created } = setup();
    const outcome = await service.create(user, 'c1', photo, JSON.stringify(ANSWERS));

    const [path, body, type] = storage.upload.mock.calls[0] as unknown as [string, Buffer, string];
    const treatmentId = created['treatment'][0]['id'] as string;
    expect(path).toBe(`treatments/${treatmentId}/pre.jpg`);
    expect(body).toBe(jpeg);
    expect(type).toBe('image/jpeg');
    expect(created['phase'][0]).toEqual(expect.objectContaining({ id: `${treatmentId}-PRE`, treatmentId, phaseType: 'PRE' }));
    expect(created['image'][0]).toEqual(expect.objectContaining({ phaseId: `${treatmentId}-PRE`, imageUrl: path }));
    expect(created['aIResult'][0]).toEqual(
      expect.objectContaining({ area: 4.2, length: 3.1, height: 1.8, confidenceScore: 0.86, modelCaseId: 'model-case-1' }),
    );
    expect(outcome).toEqual({
      status: 'ok',
      visit: expect.objectContaining({ treatmentId, photoUrl: `https://signed.example/${path}`, review: null, findings: OK }),
    });
  });

  it("sends only answers to the model's questions, with the last measured area", async () => {
    const { service, model } = setup();
    await service.create(user, 'c1', photo, JSON.stringify(ANSWERS));
    expect(model.followUps).toHaveBeenCalledWith({ diabetes: 'no', cause: 'burn', body_location: 'heel', pain: 4 });
    expect(model.analyze).toHaveBeenCalledWith(
      { buffer: jpeg, mimetype: 'image/jpeg' },
      { body_location: 'heel', cause: 'burn', diabetes: 'no', pain: 4, burn_agent: 'chemical' },
      { area_cm2: 5, days_ago: 7 },
    );
  });

  it('refuses before calling the model when something is missing or wrong', async () => {
    const { service, model } = setup();
    await expect(service.create(user, 'c1', photo, JSON.stringify({ diabetes: 'no' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(user, 'c1', undefined, JSON.stringify(ANSWERS))).rejects.toBeInstanceOf(BadRequestException);
    const text = Buffer.from('not an image');
    await expect(service.create(user, 'c1', { buffer: text, size: text.length }, JSON.stringify(ANSWERS))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create(user, 'c1', { buffer: jpeg, size: MAX_PHOTO_BYTES + 1 }, JSON.stringify(ANSWERS))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    await expect(service.create(user, 'c1', photo, '[1, 2]')).rejects.toBeInstanceOf(BadRequestException);
    expect(model.analyze).not.toHaveBeenCalled();
  });

  it("treats another user's case as not found", async () => {
    const { service, model } = setup();
    await expect(service.create({ ...user, id: 'u2' }, 'c1', photo, JSON.stringify(ANSWERS))).rejects.toBeInstanceOf(NotFoundException);
    expect(model.analyze).not.toHaveBeenCalled();
  });

  it('removes the stored photo when the database write fails', async () => {
    const { service, storage } = setup({ transactionFails: true });
    await expect(service.create(user, 'c1', photo, JSON.stringify(ANSWERS))).rejects.toThrow('database unavailable');
    const [path] = storage.upload.mock.calls[0] as unknown as [string];
    expect(storage.remove).toHaveBeenCalledWith(path);
  });
});

describe('VisitsService.review', () => {
  const draft = { id: 'r1', draftReport: 'Draft text', modelCaseId: 'model-case-1', review: null };

  it('approving keeps the draft as the final report and tells the model with an opaque id', async () => {
    const { service, prisma, model, users } = setup({ aiResult: draft });
    const review = await service.review(user, 'r1', { decision: 'approved', finalReport: null, reason: null, corrections: null });
    expect(users.ensure).toHaveBeenCalledWith(user);
    expect(prisma.aIReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ aiResultId: 'r1', reviewerId: 'u1', decision: 'approved', finalReport: 'Draft text', reason: null }),
    });
    expect(model.review).toHaveBeenCalledWith({
      case_id: 'model-case-1',
      reviewer_id: 'u1',
      decision: 'approved',
      final_summary: 'Draft text',
      corrections: null,
    });
    expect(review).toEqual(expect.objectContaining({ decision: 'approved', finalReport: 'Draft text' }));
  });

  it('a draft is reviewed once', async () => {
    const { service, prisma } = setup({ aiResult: { ...draft, review: { decision: 'approved' } } });
    await expect(
      service.review(user, 'r1', { decision: 'rejected', finalReport: null, reason: 'Wrong wound', corrections: null }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.aIReview.create).not.toHaveBeenCalled();
  });

  it("treats another user's result as not found", async () => {
    const { service } = setup({ aiResult: null });
    await expect(
      service.review(user, 'r1', { decision: 'approved', finalReport: null, reason: null, corrections: null }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
