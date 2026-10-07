"use client"
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import type { CaseSummary, PatientSummary } from "@antigravity-project-spec-pack/domain/wound-model";
import { Button } from "../../../../components/ui/button";
import { Field, PageNote, fieldClass } from "../../../../components/ui/field";
import { ApiError, api, errorMessage, useApi } from "../../../../lib/api";
import { SEX_NAME, dateText, todayISO } from "../../../../lib/format";

/** Opens a case for a new wound, then goes straight to it. */
function NewWoundForm({ patientId, onCancel }: { patientId: string; onCancel: () => void }) {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [onset, setOnset] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const local = [!location.trim() && "location", !onset && "onset"].filter((p): p is string => typeof p === "string");
    setProblems(local);
    if (local.length) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const created = await api<CaseSummary>("/cases", { method: "POST", body: JSON.stringify({ patientId, location, onset }) });
      router.push(`/cases/${created.id}`);
    } catch (error) {
      setProblems(error instanceof ApiError ? error.problems : []);
      setMessage(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-black/10 p-5 dark:border-white/10" noValidate>
      <p className="font-semibold">New wound</p>
      <Field label="Wound location" hint="Side and body site, for example Left heel" required problem={problems.includes("location") ? "Enter where the wound is." : undefined}>
        {(id) => <input id={id} className={fieldClass} value={location} onChange={(e) => setLocation(e.target.value)} />}
      </Field>
      <Field label="Onset date" hint="When the wound first appeared" required problem={problems.includes("onset") ? "Enter a date that isn't in the future." : undefined}>
        {(id) => <input id={id} type="date" max={todayISO()} className={`${fieldClass} max-w-52`} value={onset} onChange={(e) => setOnset(e.target.value)} />}
      </Field>
      {message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add wound"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: patient, error, loading } = useApi<PatientSummary>(`/patients/${id}`);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState<string>();

  const removePatient = async () => {
    if (!patient) return;
    const name = `${patient.firstName} ${patient.lastName}`;
    if (!window.confirm(`Delete ${name} with every wound, visit and photo? This can't be undone.`)) return;
    setDeleting(true);
    setDeleteProblem(undefined);
    try {
      await api<void>(`/patients/${patient.id}`, { method: "DELETE" });
      router.push("/patients");
    } catch (e) {
      setDeleteProblem(errorMessage(e));
      setDeleting(false);
    }
  };

  if (loading && !patient) return <PageNote>Loading the patient…</PageNote>;
  if (error || !patient) return <PageNote tone="error">{error?.message ?? "Patient not found."}</PageNote>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/patients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Patients
        </Link>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">
          {patient.firstName} {patient.lastName}
        </h2>
        <p className="text-sm text-muted-foreground">
          ID {patient.patientId} · born {dateText(patient.dateOfBirth)} · {SEX_NAME[patient.sex] ?? patient.sex}
          {patient.location && ` · ${patient.location}`}
        </p>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void removePatient()}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" /> {deleting ? "Deleting…" : "Delete patient"}
        </button>
        {deleteProblem && (
          <p role="alert" className="text-sm text-destructive">
            {deleteProblem}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            Wounds <span className="font-normal text-muted-foreground">{patient.cases.length}</span>
          </h3>
          {!adding && (
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-1" /> New wound
            </Button>
          )}
        </div>
        {adding && <NewWoundForm patientId={patient.id} onCancel={() => setAdding(false)} />}
        {patient.cases.length === 0 && !adding && <PageNote>No wounds recorded yet.</PageNote>}
        {patient.cases.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 transition-colors hover:bg-black/[0.02] dark:border-white/10 dark:bg-black/20"
          >
            <div>
              <p className="font-medium">{c.location}</p>
              <p className="text-sm text-muted-foreground">
                Onset {dateText(c.onset)}
                {c.woundType !== "Not recorded" && ` · ${c.woundType}`}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </section>
    </div>
  );
}
