"use client"
import { Check } from "lucide-react";
import {
  REQUIRED_INTAKE,
  optionLabel,
  type IntakeAnswers,
  type IntakeQuestion,
} from "@antigravity-project-spec-pack/domain/wound-model";
import { Field, fieldClass } from "../ui/field";

const CHIP_LIMIT = 6; // more options than this read better as a list

// Words in a wound's location (from the case or the body diagram) that map onto the model's body sites.
const SITE_WORDS: [RegExp, string][] = [
  [/\bheel/i, "heel"],
  [/\btoe/i, "toe"],
  [/\bankle/i, "ankle"],
  [/\bknee/i, "knee"],
  [/\bthigh/i, "thigh"],
  [/\b(lower leg|calf|shin)/i, "lower_leg"],
  [/\b(sacrum|buttock)/i, "sacrum_buttock"],
  [/\bhip/i, "hip"],
  [/\bback\b(?! of)/i, "back"],
  [/\babdomen/i, "abdomen"],
  [/\bchest/i, "chest"],
  [/\bhand/i, "hand"],
  [/\b(arm|forearm|elbow|shoulder)/i, "arm"],
  [/\b(head|neck|face)/i, "head_neck"],
  [/\b(sole|plantar)/i, "foot_plantar"],
  [/\b(dorsum|dorsal)/i, "foot_dorsal"],
];

/** The model's body site for a free-text location ("Left heel" → heel), when it's unambiguous. */
export const bodySiteFor = (location: string, options: string[] = []): string | undefined => {
  const site = SITE_WORDS.find(([pattern]) => pattern.test(location))?.[1];
  return site && options.includes(site) ? site : undefined;
};

/**
 * The model's intake questions. Free-text questions are left out: the API never sends free text to the model,
 * because it can carry identifying details.
 */
export function IntakeForm({
  questions,
  answers,
  onChange,
  missing = [],
}: {
  questions: IntakeQuestion[];
  answers: IntakeAnswers;
  onChange: (answers: IntakeAnswers) => void;
  /** Required questions still unanswered after a submit attempt. */
  missing?: string[];
}) {
  const set = (id: string, value: string | number | undefined) => {
    const next = { ...answers };
    if (value === undefined || value === "") delete next[id];
    else next[id] = value;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-6">
      {questions
        .filter((q) => q.type !== "text")
        .map((q) => {
          const required = (REQUIRED_INTAKE as readonly string[]).includes(q.id);
          const problem = missing.includes(q.id) ? "Answer this question to continue." : undefined;
          const value = answers[q.id];
          return (
            <Field key={q.id} label={q.text} required={required} problem={problem}>
              {(id) =>
                q.type === "number" ? (
                  <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    max={/0 \(none\) to 10/.test(q.text) ? 10 : undefined}
                    className={`${fieldClass} max-w-40`}
                    value={value ?? ""}
                    onChange={(e) => set(q.id, e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                ) : (q.options ?? []).length > CHIP_LIMIT ? (
                  <select id={id} className={fieldClass} value={value ?? ""} onChange={(e) => set(q.id, e.target.value)}>
                    <option value="">Choose…</option>
                    {(q.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {optionLabel(o)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div id={id} role="radiogroup" aria-label={q.text} className="flex flex-wrap gap-2">
                    {(q.options ?? []).map((o) => {
                      const on = value === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set(q.id, on && !required ? undefined : o)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                            on
                              ? "border-primary bg-primary/10 text-primary"
                              : `border-black/10 bg-white hover:bg-black/[0.03] dark:border-white/10 dark:bg-black/20 ${problem ? "border-destructive/60" : ""}`
                          }`}
                        >
                          {on && <Check className="w-3.5 h-3.5" />}
                          {optionLabel(o)}
                        </button>
                      );
                    })}
                  </div>
                )
              }
            </Field>
          );
        })}
    </div>
  );
}
