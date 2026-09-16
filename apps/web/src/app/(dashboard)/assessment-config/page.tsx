"use client"
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Edit2, Trash2, ArrowUp, ArrowDown,
  Settings2, Save, X, ChevronRight, Hash, ToggleLeft, Layers,
  GripVertical
} from "lucide-react";

type QuestionType = "chip_single" | "chip_multi" | "numeric";

interface AssessmentQuestion {
  id: string;
  title: string;
  type: QuestionType;
  options: string[] | null;
  required: boolean;
  order: number;
  active: boolean;
  followUpOnly: boolean;
}

/* ── tiny primitives ──────────────────────────────────────── */

const inputCls =
  "w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/20 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all";

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left group w-full"
    >
      <div className={`relative mt-0.5 w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ${checked ? "bg-primary" : "bg-black/10 dark:bg-white/10"}`}>
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </button>
  );
}

const TYPE_OPTIONS: { value: QuestionType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "chip_single", label: "Single Select", desc: "Pick one from chips", icon: <ToggleLeft className="w-4 h-4" /> },
  { value: "chip_multi",  label: "Multi Select",  desc: "Pick many from chips", icon: <Layers className="w-4 h-4" /> },
  { value: "numeric",     label: "Numeric",        desc: "Stepper / number input", icon: <Hash className="w-4 h-4" /> },
];

const TYPE_LABEL: Record<QuestionType, string> = {
  chip_single: "Single Select",
  chip_multi:  "Multi Select",
  numeric:     "Numeric",
};

/* ── main page ────────────────────────────────────────────── */

export default function AssessmentConfigPage() {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [formData,  setFormData]  = useState<Partial<AssessmentQuestion>>({});

  useEffect(() => { fetchQuestions(); }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch("/api/assessment-questions");
      if (res.ok) setQuestions(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openNew = () => {
    setFormData({ title: "", type: "chip_single", options: [], required: false, active: true, followUpOnly: false });
    setEditingId("new");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId === "new") {
        await fetch("/api/assessment-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, order: formData.order ?? questions.length }),
        });
      } else {
        await fetch(`/api/assessment-questions/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }
      setEditingId(null);
      fetchQuestions();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    await fetch(`/api/assessment-questions/${id}`, { method: "DELETE" });
    fetchQuestions();
  };

  const moveOrder = async (index: number, dir: -1 | 1) => {
    if (index + dir < 0 || index + dir >= questions.length) return;
    const arr = [...questions];
    const a = arr[index], b = arr[index + dir];
    [a.order, b.order] = [b.order, a.order];
    arr.sort((x, y) => x.order - y.order);
    setQuestions(arr);
    await Promise.all([
      fetch(`/api/assessment-questions/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) }),
      fetch(`/api/assessment-questions/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: b.order }) }),
    ]);
  };

  const spring = { type: "spring" as const, stiffness: 340, damping: 28 };

  return (
    <div className="flex flex-col gap-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={spring}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Assessment Form</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure clinical questions for the mobile app</p>
        </div>
        <Button
          onClick={openNew}
          className="rounded-full shadow-lg shadow-primary/20 self-start sm:self-auto gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </Button>
      </motion.div>

      {/* ── Form Panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {editingId && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={spring}
          >
            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-primary/3 shadow-xl shadow-primary/5 overflow-hidden">

              {/* Form header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Settings2 className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-base">
                    {editingId === "new" ? "New Question" : "Edit Question"}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-6">

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question Title</label>
                  <input
                    type="text"
                    value={formData.title || ""}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. WOUND TYPE"
                  />
                </div>

                {/* Type selector cards */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: opt.value })}
                        className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                          formData.type === opt.value
                            ? "border-primary/40 bg-primary/10 ring-2 ring-primary/20 shadow-sm"
                            : "border-black/8 dark:border-white/8 bg-white/60 dark:bg-black/10 hover:border-primary/20 hover:bg-primary/5"
                        }`}
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          formData.type === opt.value ? "bg-primary text-white" : "bg-black/5 dark:bg-white/5 text-muted-foreground"
                        }`}>
                          {opt.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options (chip types only) */}
                <AnimatePresence>
                  {(formData.type === "chip_single" || formData.type === "chip_multi") && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Answer Options <span className="font-normal normal-case">(comma-separated)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.options?.join(", ") || ""}
                        onChange={e => setFormData({
                          ...formData,
                          options: e.target.value.split(",").map(s => s.trim()).filter(s => s.length > 0),
                        })}
                        className={inputCls}
                        placeholder="e.g. Pressure Ulcer, DFU, VLU"
                      />
                      {/* Live chip preview */}
                      {(formData.options?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {formData.options?.map(opt => (
                            <span key={opt} className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5">
                  <Toggle
                    checked={formData.required ?? false}
                    onChange={v => setFormData({ ...formData, required: v })}
                    label="Required"
                    hint="Must be answered"
                  />
                  <Toggle
                    checked={formData.active ?? true}
                    onChange={v => setFormData({ ...formData, active: v })}
                    label="Active"
                    hint="Shown in mobile app"
                  />
                  <Toggle
                    checked={formData.followUpOnly ?? false}
                    onChange={v => setFormData({ ...formData, followUpOnly: v })}
                    label="Follow-up Only"
                    hint="Hidden on initial visit"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-1">
                  <Button variant="secondary" className="rounded-full" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button className="rounded-full shadow-md shadow-primary/20 gap-2" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? "Saving…" : "Save Question"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Questions List ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}
        className="flex flex-col gap-3"
      >
        {loading ? (
          /* Skeleton */
          [1,2,3].map(n => (
            <div key={n} className="h-20 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
          ))
        ) : questions.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-black/8 dark:border-white/8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Settings2 className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-base mb-1">No questions yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs mb-5">
              Add your first clinical assessment question to get started.
            </p>
            <Button onClick={openNew} className="rounded-full gap-2">
              <Plus className="w-4 h-4" /> Add First Question
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {questions.map((q, i) => (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={spring}
              >
                <div className={`group relative flex items-center gap-3 p-4 rounded-2xl border bg-white dark:bg-black/20 shadow-sm hover:shadow-md transition-all duration-200 ${
                  editingId === q.id ? "border-primary/30 ring-2 ring-primary/15" : "border-black/6 dark:border-white/6"
                }`}>

                  {/* Drag handle / order */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0 text-muted-foreground/40">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Order controls */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button
                      disabled={i === 0}
                      onClick={() => moveOrder(i, -1)}
                      className="p-1 rounded-md disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-mono text-muted-foreground w-4 text-center">{q.order}</span>
                    <button
                      disabled={i === questions.length - 1}
                      onClick={() => moveOrder(i, 1)}
                      className="p-1 rounded-md disabled:opacity-20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{q.title}</span>
                      {q.required && <span className="text-destructive text-xs font-bold">*</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[11px] font-medium font-mono text-muted-foreground">
                        {TYPE_LABEL[q.type]}
                      </span>
                      {q.active ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-black/5 text-muted-foreground text-[11px] font-medium">Inactive</span>
                      )}
                      {q.followUpOnly && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-medium">Follow-up</span>
                      )}
                    </div>
                    {q.options && q.options.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {q.options.slice(0, 4).map(opt => (
                          <span key={opt} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/8 text-primary/80 border border-primary/15">
                            {opt}
                          </span>
                        ))}
                        {q.options.length > 4 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground">
                            +{q.options.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={() => { setFormData(q); setEditingId(q.id); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}
