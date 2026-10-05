"use client"
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Eye, EyeOff, Lock, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import {
  BUILT_IN_FIELDS,
  NUMERIC_SCALE,
  QUESTION_LIMITS,
  checkQuestion,
  questionsFor,
  type Question,
  type QuestionForm,
  type QuestionType,
} from "@antigravity-project-spec-pack/domain/questions";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { api, ApiError, errorMessage } from "../../../lib/api";
import { supabaseBrowser as supabase } from "../../../lib/supabase/client";

const FORMS: { value: QuestionForm; label: string; when: string }[] = [
  { value: "assessment", label: "Assessment", when: "Asked before treatment, after the pre-treatment image." },
  { value: "care", label: "Care", when: "Asked after treatment, after the post-treatment image." },
];

const TYPES: { value: QuestionType; label: string; detail: string }[] = [
  { value: "chip_single", label: "Single choice", detail: "Pick one option" },
  { value: "chip_multi", label: "Multiple choice", detail: "Pick any options that apply" },
  { value: "numeric", label: `Scale ${NUMERIC_SCALE.min}–${NUMERIC_SCALE.max}`, detail: "Pick a number, like the pain score" },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label])) as Record<QuestionType, string>;

export default function QuestionsPage() {
  const [form, setForm] = useState<QuestionForm>("assessment");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // a question id, or "new"
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setQuestions(await api<Question[]>("/questions?includeHidden=true"));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    load();
    // Only decides what to show. The API checks the role again on every change.
    supabase.auth.getSession().then(({ data }) => setIsAdmin(data.session?.user.app_metadata?.role === "admin"));
  }, [load]);

  const shown = useMemo(() => questionsFor(questions ?? [], form), [questions, form]);
  const current = FORMS.find((f) => f.value === form)!;

  const switchForm = (next: QuestionForm) => {
    setForm(next);
    setEditing(null);
    setConfirming(null);
  };

  const replace = (question: Question) =>
    setQuestions((all) => (all ?? []).map((q) => (q.id === question.id ? question : q)));

  // Runs one change at a time; a failure leaves the list as the server has it and says why.
  const act = async (change: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await change();
    } catch (error) {
      setNotice(errorMessage(error));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, by: -1 | 1) =>
    act(async () => {
      const ids = shown.map((q) => q.id);
      [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
      setQuestions((all) => (all ?? []).map((q) => (q.form === form ? { ...q, order: ids.indexOf(q.id) } : q)));
      const ordered = await api<Question[]>(`/questions/order/${form}`, { method: "PUT", body: JSON.stringify({ ids }) });
      setQuestions((all) => [...(all ?? []).filter((q) => q.form !== form), ...ordered]);
    });

  const toggleShown = (question: Question) =>
    act(async () => {
      replace(await api<Question>(`/questions/${question.id}`, { method: "PATCH", body: JSON.stringify({ active: !question.active }) }));
    });

  const remove = (question: Question) =>
    act(async () => {
      await api(`/questions/${question.id}`, { method: "DELETE" });
      setQuestions((all) => (all ?? []).filter((q) => q.id !== question.id));
      setConfirming(null);
    });

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Questions</h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">
            What clinicians are asked in the mobile app. Devices pick up changes the next time they&apos;re online.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing("new");
              setConfirming(null);
            }}
            disabled={!questions || editing === "new"}
            className="self-start sm:self-auto gap-2"
          >
            <Plus className="w-4 h-4" />
            Add question
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div role="tablist" aria-label="Form" className="inline-flex self-start rounded-full bg-black/[0.04] p-1">
          {FORMS.map((f) => {
            const count = questions ? questions.filter((q) => q.form === f.value).length : null;
            const selected = f.value === form;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => switchForm(f.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                {count !== null && <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">{current.when}</p>
      </div>

      {questions &&
        (isAdmin ? (
          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            Changes apply to every clinician&apos;s app. Get clinical sign-off before changing wound types, exudate lists or
            pain scales.
          </p>
        ) : (
          <p className="rounded-2xl bg-black/[0.04] px-4 py-3 text-sm text-muted-foreground">
            You can view the questions. Only admins can change them.
          </p>
        ))}

      {notice && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-medium underline-offset-4 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {loadError ? (
        <Card>
          <div className="flex flex-col items-start gap-3 px-6 py-8">
            <p className="font-medium">Couldn&apos;t load the questions</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-2">
              <RotateCw className="w-4 h-4" />
              Try again
            </Button>
          </div>
        </Card>
      ) : !questions ? (
        <Card>
          <ol aria-busy="true" aria-label="Loading questions" className="divide-y divide-black/5">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex gap-4 px-5 py-5 md:px-6">
                <span className="h-4 w-4 rounded bg-black/[0.06]" />
                <span className="flex-1 space-y-2">
                  <span className="block h-4 w-1/3 rounded bg-black/[0.06]" />
                  <span className="block h-3 w-2/3 rounded bg-black/[0.04]" />
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card>
          {editing === "new" && (
            <QuestionEditor
              form={form}
              formLabel={current.label}
              onCancel={() => setEditing(null)}
              onSaved={(question) => {
                setQuestions((all) => [...(all ?? []), question]);
                setEditing(null);
              }}
            />
          )}
          {shown.length === 0 && editing !== "new" ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">No {current.label.toLowerCase()} questions yet.</p>
          ) : (
            <ol className="divide-y divide-black/5 dark:divide-white/5">
              {shown.map((question, index) =>
                editing === question.id ? (
                  <li key={question.id}>
                    <QuestionEditor
                      form={form}
                      formLabel={current.label}
                      question={question}
                      onCancel={() => setEditing(null)}
                      onSaved={(saved) => {
                        replace(saved);
                        setEditing(null);
                      }}
                    />
                  </li>
                ) : (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    position={index + 1}
                    isAdmin={isAdmin}
                    busy={busy}
                    isFirst={index === 0}
                    isLast={index === shown.length - 1}
                    confirming={confirming === question.id}
                    onMove={(by) => move(index, by)}
                    onToggleShown={() => toggleShown(question)}
                    onEdit={() => {
                      setEditing(question.id);
                      setConfirming(null);
                    }}
                    onAskDelete={() => setConfirming(question.id)}
                    onCancelDelete={() => setConfirming(null)}
                    onDelete={() => remove(question)}
                  />
                ),
              )}
            </ol>
          )}
        </Card>
      )}
    </div>
  );
}

function QuestionRow({
  question,
  position,
  isAdmin,
  busy,
  isFirst,
  isLast,
  confirming,
  onMove,
  onToggleShown,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  question: Question;
  position: number;
  isAdmin: boolean;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  confirming: boolean;
  onMove: (by: -1 | 1) => void;
  onToggleShown: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={`flex flex-col gap-3 px-5 py-4 sm:flex-row md:px-6 ${question.active ? "" : "bg-black/[0.015]"}`}>
      <div className="flex min-w-0 flex-1 gap-4">
        <span className="w-5 shrink-0 pt-px text-sm font-medium tabular-nums text-muted-foreground">{position}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`font-medium ${question.active ? "" : "text-muted-foreground"}`}>{question.title}</p>
            {question.required && <Badge>Required</Badge>}
            {question.followUpOnly && <Badge variant="secondary">Follow-ups only</Badge>}
            {!question.active && <Badge variant="warning">Hidden</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            {TYPE_LABEL[question.type]}
            {question.fieldKey && (
              <span className="inline-flex items-center gap-1" title="Built-in questions can be hidden but not deleted, and keep their answer type.">
                <span aria-hidden>·</span>
                <Lock className="w-3 h-3" />
                Built-in
              </span>
            )}
          </p>
          {question.options && <p className="mt-1.5 text-sm text-foreground/80">{question.options.join(" · ")}</p>}

          {confirming && (
            <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm">
              <span className="text-destructive">Delete this question? Answers already recorded keep it.</span>
              <span className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelDelete}>
                  Cancel
                </Button>
              </span>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="flex shrink-0 items-start gap-1 pl-9 sm:pl-0">
          <IconButton label="Move up" disabled={busy || isFirst} onClick={() => onMove(-1)}>
            <ArrowUp className="w-4 h-4" />
          </IconButton>
          <IconButton label="Move down" disabled={busy || isLast} onClick={() => onMove(1)}>
            <ArrowDown className="w-4 h-4" />
          </IconButton>
          <IconButton label={question.active ? "Hide from the app" : "Show in the app"} disabled={busy} onClick={onToggleShown}>
            {question.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </IconButton>
          <IconButton label="Edit" disabled={busy} onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </IconButton>
          {!question.fieldKey && (
            <IconButton label="Delete" disabled={busy} onClick={onAskDelete} destructive>
              <Trash2 className="w-4 h-4" />
            </IconButton>
          )}
        </div>
      )}
    </li>
  );
}

function IconButton({
  label,
  disabled,
  destructive,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        destructive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-black/5 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionEditor({
  form,
  formLabel,
  question,
  onCancel,
  onSaved,
}: {
  form: QuestionForm;
  formLabel: string;
  question?: Question;
  onCancel: () => void;
  onSaved: (question: Question) => void;
}) {
  const id = useId();
  const builtIn = question?.fieldKey ? BUILT_IN_FIELDS[question.fieldKey] : undefined;
  const [title, setTitle] = useState(question?.title ?? "");
  const [type, setType] = useState<QuestionType>(question?.type ?? "chip_single");
  const [options, setOptions] = useState((question?.options ?? []).join("\n"));
  const [required, setRequired] = useState(question?.required ?? false);
  const [followUpOnly, setFollowUpOnly] = useState(question?.followUpOnly ?? false);
  const [active, setActive] = useState(question?.active ?? true);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const hasOptions = type !== "numeric";
  const optionCount = options.split("\n").filter((o) => o.trim()).length;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const changes = { title, type, options: hasOptions ? options.split("\n") : null, required, followUpOnly, active };
    // The same rules the API applies, so most problems show up without a round trip.
    const check = checkQuestion(question ? changes : { ...changes, form }, question);
    if (!check.ok) {
      setProblems(check.problems);
      return;
    }
    setSaving(true);
    setProblems([]);
    try {
      const saved = question
        ? await api<Question>(`/questions/${question.id}`, { method: "PATCH", body: JSON.stringify(changes) })
        : await api<Question>("/questions", { method: "POST", body: JSON.stringify({ ...changes, form }) });
      onSaved(saved);
    } catch (error) {
      setProblems(error instanceof ApiError && error.problems.length > 0 ? error.problems : [errorMessage(error)]);
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-black/[0.03] disabled:text-muted-foreground dark:border-white/10 dark:bg-black/20";

  return (
    <form onSubmit={save} aria-label={question ? "Edit question" : "New question"} className="flex flex-col gap-5 bg-primary/[0.025] px-5 py-5 md:px-6">
      <p className="text-sm font-semibold">{question ? "Edit question" : `New ${formLabel.toLowerCase()} question`}</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-title`} className="text-sm font-medium">
          Question
        </label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={QUESTION_LIMITS.title + 20}
          autoFocus
          placeholder="Wound odour"
          className={field}
        />
      </div>

      <fieldset className="flex flex-col gap-2" disabled={!!builtIn}>
        <legend className="mb-1.5 text-sm font-medium">Answer</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                type === t.value ? "border-primary/50 bg-primary/[0.06]" : "border-black/10 bg-white hover:border-black/20 dark:bg-black/20"
              } ${builtIn ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name={`${id}-type`}
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="mt-0.5 accent-[hsl(var(--primary))]"
              />
              <span>
                <span className="block font-medium">{t.label}</span>
                <span className="block text-muted-foreground">{t.detail}</span>
              </span>
            </label>
          ))}
        </div>
        {builtIn && <p className="text-sm text-muted-foreground">Built-in questions keep their answer type.</p>}
      </fieldset>

      {hasOptions && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-options`} className="text-sm font-medium">
            Options
          </label>
          <textarea
            id={`${id}-options`}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            disabled={builtIn?.fixedOptions}
            rows={Math.min(10, Math.max(4, optionCount + 1))}
            placeholder={"None\nFaint\nStrong"}
            className={`${field} resize-y leading-6`}
          />
          <p className="text-sm text-muted-foreground">
            {builtIn?.fixedOptions
              ? "These options can't change: the app compares these exact values."
              : `One option per line, in the order clinicians see them. ${optionCount} ${optionCount === 1 ? "option" : "options"}.`}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Check checked={required} onChange={setRequired} label="Required" hint="Clinicians must answer before they can continue." />
        <Check checked={followUpOnly} onChange={setFollowUpOnly} label="Follow-up visits only" hint="Asked from a case's second treatment onwards." />
        <Check checked={active} onChange={setActive} label="Shown in the app" hint="Hidden questions aren't asked. Answers already recorded are kept." />
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save question"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded accent-[hsl(var(--primary))]"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
