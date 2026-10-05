import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_QUESTIONS,
  checkQuestion,
  type Question,
  type QuestionChanges,
  type QuestionForm,
  type QuestionType,
} from '@antigravity-project-spec-pack/domain/questions';
import { PrismaService } from '../prisma.service';

type QuestionRow = Awaited<ReturnType<PrismaService['assessmentQuestion']['findFirstOrThrow']>>;

const toQuestion = (row: QuestionRow): Question => ({
  id: row.id,
  form: row.form as QuestionForm,
  fieldKey: row.fieldKey,
  title: row.title,
  type: row.type as QuestionType,
  options: Array.isArray(row.options) ? row.options.filter((o): o is string => typeof o === 'string') : null,
  required: row.required,
  order: row.order,
  active: row.active,
  followUpOnly: row.followUpOnly,
});

const invalid = (problems: string[]) => new BadRequestException({ message: problems.join(' '), problems });

@Injectable()
export class QuestionsService implements OnModuleInit {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const added = await this.seedBuiltIns();
      if (added > 0) this.logger.log(`Added ${added} built-in questions to the catalog.`);
    } catch (error) {
      // The API still starts without a database; the catalog is seeded on the next start.
      this.logger.warn(`Couldn't seed the question catalog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Adds any built-in question the catalog is missing. Existing questions, including edited ones, are left alone. */
  async seedBuiltIns(): Promise<number> {
    const rows = await this.prisma.assessmentQuestion.findMany({ select: { form: true, fieldKey: true, order: true } });
    const present = new Set(rows.map((row) => `${row.form}:${row.fieldKey}`));
    const missing = DEFAULT_QUESTIONS.filter((q) => !present.has(`${q.form}:${q.fieldKey}`));
    if (missing.length === 0) return 0;

    // Into an empty form they go in their default order; otherwise after the questions already there.
    const nextOrder = new Map<string, number>();
    for (const row of rows) nextOrder.set(row.form, Math.max(nextOrder.get(row.form) ?? 0, row.order + 1));
    const data = missing.map(({ id: _defaultId, options, order, ...question }) => {
      const after = nextOrder.get(question.form);
      if (after !== undefined) nextOrder.set(question.form, after + 1);
      return { ...question, options: options ?? Prisma.DbNull, order: after ?? order };
    });
    const { count } = await this.prisma.assessmentQuestion.createMany({ data, skipDuplicates: true });
    return count;
  }

  async list(form?: QuestionForm, includeHidden = false): Promise<Question[]> {
    const rows = await this.prisma.assessmentQuestion.findMany({
      where: { ...(form ? { form } : {}), ...(includeHidden ? {} : { active: true }) },
      orderBy: [{ form: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toQuestion);
  }

  /** Adds a question to the end of its form. */
  async create(changes: QuestionChanges, userId: string): Promise<Question> {
    const check = checkQuestion(changes);
    if (!check.ok) throw invalid(check.problems);
    const { _max } = await this.prisma.assessmentQuestion.aggregate({
      where: { form: check.value.form },
      _max: { order: true },
    });
    const row = await this.prisma.assessmentQuestion.create({
      data: {
        ...check.value,
        options: check.value.options ?? Prisma.DbNull,
        fieldKey: null,
        order: (_max.order ?? -1) + 1,
        updatedBy: userId,
      },
    });
    return toQuestion(row);
  }

  async update(id: string, changes: QuestionChanges, userId: string): Promise<Question> {
    const current = await this.find(id);
    const check = checkQuestion(changes, current);
    if (!check.ok) throw invalid(check.problems);
    const row = await this.prisma.assessmentQuestion.update({
      where: { id },
      data: { ...check.value, options: check.value.options ?? Prisma.DbNull, updatedBy: userId },
    });
    return toQuestion(row);
  }

  /** Deletes an admin-added question. Answers already recorded keep their copy of the question. */
  async remove(id: string): Promise<void> {
    const current = await this.find(id);
    if (current.fieldKey) throw new ConflictException("Built-in questions can't be deleted. Hide them instead.");
    await this.prisma.assessmentQuestion.delete({ where: { id } });
  }

  /** Puts a form's questions in the given order. The list must name every question in the form exactly once. */
  async reorder(form: QuestionForm, ids: unknown, userId: string): Promise<Question[]> {
    const rows = await this.prisma.assessmentQuestion.findMany({ where: { form }, select: { id: true, order: true } });
    const complete =
      Array.isArray(ids) &&
      ids.length === rows.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => rows.some((row) => row.id === id));
    if (!complete) throw invalid(["The new order must list each of the form's questions once."]);

    const changed = (ids as string[]).filter((id, order) => rows.find((row) => row.id === id)?.order !== order);
    await this.prisma.$transaction(
      changed.map((id) =>
        this.prisma.assessmentQuestion.update({
          where: { id },
          data: { order: (ids as string[]).indexOf(id), updatedBy: userId },
        }),
      ),
    );
    return this.list(form, true);
  }

  private async find(id: string): Promise<Question> {
    const row = await this.prisma.assessmentQuestion.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('That question no longer exists.');
    return toQuestion(row);
  }
}
