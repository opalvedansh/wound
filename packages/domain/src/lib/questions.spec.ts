import { BUILT_IN_FIELDS, DEFAULT_QUESTIONS, checkQuestion, questionsFor, type Question } from './questions';

const builtIn = (fieldKey: string) => DEFAULT_QUESTIONS.find((q) => q.fieldKey === fieldKey) as Question;

const custom: Question = {
  id: 'q1',
  form: 'assessment',
  fieldKey: null,
  title: 'Odour',
  type: 'chip_single',
  options: ['None', 'Faint', 'Strong'],
  required: false,
  order: 9,
  active: true,
  followUpOnly: false,
};

describe('DEFAULT_QUESTIONS', () => {
  it('has one question for every built-in field, on the right form with the right type', () => {
    for (const [fieldKey, field] of Object.entries(BUILT_IN_FIELDS)) {
      const matches = DEFAULT_QUESTIONS.filter((q) => q.fieldKey === fieldKey);
      expect(matches).toHaveLength(1);
      expect(matches[0].form).toBe(field.form);
      expect(matches[0].type).toBe(field.type);
    }
  });

  it('passes its own rules', () => {
    for (const question of DEFAULT_QUESTIONS) {
      expect(checkQuestion({}, question)).toEqual(expect.objectContaining({ ok: true }));
    }
  });

  it('orders each form from 0', () => {
    expect(questionsFor(DEFAULT_QUESTIONS, 'care').map((q) => q.fieldKey)).toEqual([
      'therapyGiven',
      'dressingType',
      'nextVisitDate',
    ]);
  });
});

describe('checkQuestion: new questions', () => {
  it('cleans up the title and options', () => {
    const result = checkQuestion({
      form: 'care',
      title: '  Offloading   device ',
      type: 'chip_multi',
      options: [' Boot', '', 'Felt  padding ', 42],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        form: 'care',
        title: 'Offloading device',
        type: 'chip_multi',
        options: ['Boot', 'Felt padding'],
        required: false,
        active: true,
        followUpOnly: false,
      },
    });
  });

  it('drops options from numeric questions', () => {
    const result = checkQuestion({ form: 'assessment', title: 'Itch', type: 'numeric', options: ['a', 'b'] });
    expect(result.ok && result.value.options).toBeNull();
  });

  it('reports every problem at once', () => {
    const result = checkQuestion({ form: 'triage', title: ' ', type: 'free_text', required: 'yes' });
    expect(result).toEqual({
      ok: false,
      problems: [
        'Choose the form this question belongs to.',
        'Enter the question.',
        'Choose how the question is answered.',
        '"required" must be true or false.',
      ],
    });
  });

  it('needs at least two distinct options for chip questions', () => {
    expect(checkQuestion({ form: 'care', title: 'Q', type: 'chip_single', options: ['Only'] })).toEqual({
      ok: false,
      problems: ['Add at least two options.'],
    });
    expect(checkQuestion({ form: 'care', title: 'Q', type: 'chip_single', options: ['Yes', 'yes'] })).toEqual({
      ok: false,
      problems: ['Each option must be different.'],
    });
    expect(checkQuestion({ form: 'care', title: 'Q', type: 'chip_single', options: 'Yes,No' })).toEqual({
      ok: false,
      problems: ['Options must be a list.'],
    });
  });

  it('limits lengths', () => {
    const result = checkQuestion({
      form: 'care',
      title: 'x'.repeat(121),
      type: 'chip_single',
      options: ['a', 'b'.repeat(81)],
    });
    expect(result).toEqual({
      ok: false,
      problems: ['Keep the question under 120 characters.', 'Keep each option under 80 characters.'],
    });
  });
});

describe('checkQuestion: changes', () => {
  it('keeps unchanged values', () => {
    expect(checkQuestion({ required: true }, custom)).toEqual({
      ok: true,
      value: { form: 'assessment', title: 'Odour', type: 'chip_single', options: ['None', 'Faint', 'Strong'], required: true, active: true, followUpOnly: false },
    });
  });

  it("doesn't let a question move to another form", () => {
    expect(checkQuestion({ form: 'care' }, custom)).toEqual({
      ok: false,
      problems: ["A question can't move to another form."],
    });
  });

  it('lets built-in questions be reworded, hidden and given new options', () => {
    const result = checkQuestion(
      { title: 'Wound type', active: false, options: ['Pressure Ulcer', 'DFU', 'VLU', 'Skin tear'] },
      builtIn('woundType'),
    );
    expect(result.ok).toBe(true);
  });

  it("doesn't let built-in questions change their answer type", () => {
    expect(checkQuestion({ type: 'chip_multi' }, builtIn('dressingType'))).toEqual({
      ok: false,
      problems: ['Built-in questions keep their answer type.'],
    });
  });

  it('keeps the trend options fixed', () => {
    expect(checkQuestion({ options: ['Better', 'Same', 'Worse'] }, builtIn('woundAppearanceTrend'))).toEqual({
      ok: false,
      problems: ["This question's options can't change: the app compares these exact values."],
    });
    expect(checkQuestion({ title: 'Trend since last visit' }, builtIn('woundAppearanceTrend')).ok).toBe(true);
  });

  it('lets admin-added questions change type', () => {
    const result = checkQuestion({ type: 'numeric' }, custom);
    expect(result.ok && result.value).toEqual(expect.objectContaining({ type: 'numeric', options: null }));
  });
});
