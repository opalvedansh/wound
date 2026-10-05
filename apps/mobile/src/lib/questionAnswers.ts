import {
  BUILT_IN_FIELDS,
  NUMERIC_SCALE,
  type Question,
  type QuestionAnswer,
  type QuestionResponse,
} from '@antigravity-project-spec-pack/domain/questions';

/**
 * Answers in a form, keyed by the built-in field for built-in questions (the same whether the catalog came
 * from the defaults or the API) and by question id for questions an admin added.
 */
export type Answers = Record<string, QuestionAnswer | undefined>;

export const answerKey = (question: Question) => question.fieldKey ?? question.id;

/** Answers already on the record: the built-in fields, then the saved responses to added questions. */
export const answersFrom = (fields: object | undefined, responses: QuestionResponse[] | undefined): Answers => {
  const answers: Answers = {};
  const record = (fields ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(BUILT_IN_FIELDS)) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) answers[key] = value as QuestionAnswer;
  }
  for (const response of responses ?? []) answers[response.questionId] = response.answer;
  return answers;
};

/**
 * A question's current answer, leaving out anything the question no longer offers: an option an admin
 * removed, or a number off the scale. Those have to be answered again rather than saved unseen.
 */
export const answerFor = (question: Question, answers: Answers): QuestionAnswer | undefined => {
  const value = answers[answerKey(question)];
  if (question.type === 'numeric') {
    return typeof value === 'number' && value >= NUMERIC_SCALE.min && value <= NUMERIC_SCALE.max ? value : undefined;
  }
  const options = question.options ?? [];
  if (question.type === 'chip_multi') {
    const chosen = Array.isArray(value) ? value.filter((v) => options.includes(v)) : [];
    return chosen.length > 0 ? chosen : undefined;
  }
  return typeof value === 'string' && options.includes(value) ? value : undefined;
};

export const isAnswered = (question: Question, answers: Answers) => answerFor(question, answers) !== undefined;

/** The answer to the built-in question for a field, when that question was asked. */
export const fieldAnswer = (asked: Question[], answers: Answers, fieldKey: string) => {
  const question = asked.find((q) => q.fieldKey === fieldKey);
  return question ? answerFor(question, answers) : undefined;
};

export const textAnswer = (value: QuestionAnswer | undefined) => (typeof value === 'string' ? value : '');
export const listAnswer = (value: QuestionAnswer | undefined) => (Array.isArray(value) ? value : []);

/** Answers to the added questions, each kept with the question as it was asked. */
export const responsesFrom = (asked: Question[], answers: Answers): QuestionResponse[] =>
  asked.flatMap((question) => {
    const answer = question.fieldKey ? undefined : answerFor(question, answers);
    return answer === undefined ? [] : [{ questionId: question.id, title: question.title, type: question.type, answer }];
  });

/** An answer as text for a record, or undefined when there's nothing to show. */
export const answerText = (type: Question['type'], value: unknown): string | undefined => {
  if (type === 'numeric') return typeof value === 'number' ? `${value}/${NUMERIC_SCALE.max}` : undefined;
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : undefined;
  return typeof value === 'string' && value ? value : undefined;
};

export const questionHint = (question: Question) => {
  const multiple = question.type === 'chip_multi';
  if (question.required && multiple) return 'Required. Select all that apply.';
  if (question.required) return 'Required';
  return multiple ? 'Select all that apply' : undefined;
};
