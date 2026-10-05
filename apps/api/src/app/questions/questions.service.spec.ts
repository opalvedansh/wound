import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_QUESTIONS } from '@antigravity-project-spec-pack/domain/questions';
import type { PrismaService } from '../prisma.service';
import { QuestionsService } from './questions.service';

interface Row {
  id: string;
  form: string;
  fieldKey: string | null;
  title: string;
  type: string;
  options: unknown;
  required: boolean;
  order: number;
  active: boolean;
  followUpOnly: boolean;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Just enough of Prisma's assessmentQuestion delegate for the service, kept in memory. */
function fakePrisma(initial: Partial<Row>[] = []) {
  let rows: Row[] = [];
  let nextId = 1;
  const clean = (data: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === Prisma.DbNull ? null : v]));
  const insert = (data: Record<string, unknown>) => {
    const row = {
      id: `q${nextId++}`,
      fieldKey: null,
      required: false,
      order: 0,
      active: true,
      followUpOnly: false,
      updatedBy: null,
      createdAt: new Date(nextId),
      updatedAt: new Date(nextId),
      ...clean(data),
    } as Row;
    rows.push(row);
    return row;
  };
  initial.forEach((row) => insert(row));
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => row[key as keyof Row] === value);

  const assessmentQuestion = {
    findMany: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      rows.filter((row) => matches(row, where)).sort((a, b) => a.form.localeCompare(b.form) || a.order - b.order),
    ),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null),
    aggregate: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const orders = rows.filter((row) => matches(row, where)).map((row) => row.order);
      return { _max: { order: orders.length ? Math.max(...orders) : null } };
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => insert(data)),
    createMany: jest.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
      data.forEach(insert);
      return { count: data.length };
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, clean(data));
      return row;
    }),
    delete: jest.fn(async ({ where }: { where: { id: string } }) => {
      rows = rows.filter((row) => row.id !== where.id);
    }),
  };
  const prisma = { assessmentQuestion, $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)) };
  return { prisma: prisma as unknown as PrismaService, assessmentQuestion, rows: () => rows };
}

const custom = { form: 'assessment', title: 'Odour', type: 'chip_single', options: ['None', 'Strong'] };

describe('QuestionsService', () => {
  describe('seedBuiltIns', () => {
    it('fills an empty catalog with the default questions in their default order', async () => {
      const db = fakePrisma();
      const service = new QuestionsService(db.prisma);
      expect(await service.seedBuiltIns()).toBe(DEFAULT_QUESTIONS.length);
      const care = await service.list('care');
      expect(care.map((q) => [q.fieldKey, q.order])).toEqual([
        ['therapyGiven', 0],
        ['dressingType', 1],
        ['nextVisitDate', 2],
      ]);
      expect(care[0].options).toContain('Compression');
    });

    it('leaves existing and edited questions alone, and adds missing ones after them', async () => {
      const db = fakePrisma([
        { form: 'care', fieldKey: 'dressingType', title: 'Dressing applied', type: 'chip_single', options: ['Foam', 'Silver'], order: 0 },
        { form: 'care', title: 'Offloading', type: 'chip_single', options: ['Boot', 'None'], order: 4 },
      ]);
      const service = new QuestionsService(db.prisma);
      await service.seedBuiltIns();
      const care = await service.list('care');
      expect(care.map((q) => [q.title, q.order])).toEqual([
        ['Dressing applied', 0],
        ['Offloading', 4],
        ['THERAPY GIVEN', 5],
        ['NEXT VISIT / ACTION DATE', 6],
      ]);
      expect(await service.seedBuiltIns()).toBe(0);
    });

    it("doesn't stop the API from starting when the database is down", async () => {
      const db = fakePrisma();
      db.assessmentQuestion.findMany.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      await expect(new QuestionsService(db.prisma).onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('leaves out hidden questions unless asked for them', async () => {
      const db = fakePrisma([{ ...custom }, { ...custom, title: 'Hidden', active: false, order: 1 }]);
      const service = new QuestionsService(db.prisma);
      expect((await service.list('assessment')).map((q) => q.title)).toEqual(['Odour']);
      expect((await service.list('assessment', true)).map((q) => q.title)).toEqual(['Odour', 'Hidden']);
    });
  });

  describe('create', () => {
    it('adds the question to the end of its form and records who added it', async () => {
      const db = fakePrisma([{ ...custom, order: 3 }]);
      const created = await new QuestionsService(db.prisma).create({ ...custom, title: 'Tunnelling' }, 'admin-1');
      expect(created).toEqual(expect.objectContaining({ title: 'Tunnelling', order: 4, fieldKey: null }));
      expect(db.rows().find((r) => r.id === created.id)?.updatedBy).toBe('admin-1');
    });

    it('stores no options for numeric questions', async () => {
      const db = fakePrisma();
      const created = await new QuestionsService(db.prisma).create({ form: 'care', title: 'Minutes spent', type: 'numeric' }, 'a');
      expect(created.options).toBeNull();
    });

    it('rejects invalid questions with every problem listed', async () => {
      const service = new QuestionsService(fakePrisma().prisma);
      await expect(service.create({ form: 'care', title: '', type: 'chip_single', options: ['One'] }, 'a')).rejects.toMatchObject({
        response: { problems: ['Enter the question.', 'Add at least two options.'] },
      });
    });

    it("can't be used to add a built-in question", async () => {
      const db = fakePrisma();
      const created = await new QuestionsService(db.prisma).create({ ...custom, fieldKey: 'woundType' } as never, 'a');
      expect(created.fieldKey).toBeNull();
    });
  });

  describe('update', () => {
    it('rewords a built-in question but keeps its type', async () => {
      const db = fakePrisma();
      const service = new QuestionsService(db.prisma);
      await service.seedBuiltIns();
      const wound = (await service.list('assessment')).find((q) => q.fieldKey === 'woundType');
      const updated = await service.update(wound!.id, { title: 'Wound type' }, 'admin-2');
      expect(updated).toEqual(expect.objectContaining({ title: 'Wound type', type: 'chip_single', fieldKey: 'woundType' }));
      await expect(service.update(wound!.id, { type: 'numeric' }, 'admin-2')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('says when the question is gone', async () => {
      await expect(new QuestionsService(fakePrisma().prisma).update('missing', { title: 'x' }, 'a')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes added questions but only lets built-in ones be hidden', async () => {
      const db = fakePrisma([{ ...custom }, { form: 'care', fieldKey: 'dressingType', title: 'Dressing', type: 'chip_single', options: ['A', 'B'] }]);
      const service = new QuestionsService(db.prisma);
      const [added, builtIn] = db.rows();
      await service.remove(added.id);
      expect(db.rows()).toHaveLength(1);
      await expect(service.remove(builtIn.id)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reorder', () => {
    it("rewrites only the orders that changed", async () => {
      const db = fakePrisma([
        { ...custom, title: 'A', order: 0 },
        { ...custom, title: 'B', order: 1 },
        { ...custom, title: 'C', order: 2 },
      ]);
      const service = new QuestionsService(db.prisma);
      const [a, b, c] = db.rows();
      const result = await service.reorder('assessment', [b.id, a.id, c.id], 'admin-3');
      expect(result.map((q) => q.title)).toEqual(['B', 'A', 'C']);
      expect(db.assessmentQuestion.update).toHaveBeenCalledTimes(2);
    });

    it('needs every question in the form exactly once', async () => {
      const db = fakePrisma([{ ...custom, title: 'A' }, { ...custom, title: 'B', order: 1 }]);
      const service = new QuestionsService(db.prisma);
      const [a, b] = db.rows();
      for (const ids of [[a.id], [a.id, a.id], [a.id, b.id, 'other'], 'nope', undefined]) {
        await expect(service.reorder('assessment', ids, 'a')).rejects.toBeInstanceOf(BadRequestException);
      }
    });
  });
});
