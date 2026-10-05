import React from 'react';
import type { Question, QuestionAnswer } from '@antigravity-project-spec-pack/domain/questions';
import { ChoiceChips, FormField } from './Form';
import { Segmented } from './Segmented';
import { questionTitle } from '../lib/format';
import { questionHint } from '../lib/questionAnswers';

// Numeric questions use the 0-10 range of the pain score, with no colour bands:
// severity thresholds are clinical decisions the form doesn't make.
const SCALE_OPTIONS = Array.from({ length: 11 }, (_, n) => ({ value: n, label: String(n) }));

/** One catalog question as a form field: a 0-10 scale, or chips for single and multiple choice. */
export const QuestionField = ({
  question,
  value,
  onChange,
  error,
}: {
  question: Question;
  value: QuestionAnswer | undefined;
  onChange: (value: QuestionAnswer) => void;
  error?: string;
}) => {
  const title = questionTitle(question.title);
  return (
    <FormField label={title} hint={questionHint(question)} error={error} style={{ marginTop: 0 }}>
      {question.type === 'numeric' ? (
        <Segmented
          options={SCALE_OPTIONS}
          value={typeof value === 'number' ? value : undefined}
          onChange={onChange}
          accessibilityLabel={title}
          invalid={error !== undefined}
        />
      ) : (
        <ChoiceChips
          options={question.options ?? []}
          value={typeof value === 'number' ? undefined : value}
          onChange={onChange}
          accessibilityLabel={title}
          multiple={question.type === 'chip_multi'}
          required={question.required}
          invalid={error !== undefined}
        />
      )}
    </FormField>
  );
};
