"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { CONSENT_NOTICE_VERSION } from "@antigravity-project-spec-pack/domain";
import type { PatientSummary } from "@antigravity-project-spec-pack/domain/wound-model";
import { Button } from "../../../components/ui/button";
import { Field, fieldClass } from "../../../components/ui/field";
import { ApiError, api, errorMessage } from "../../../lib/api";
import { todayISO } from "../../../lib/format";

const MESSAGES: Record<string, string> = {
  firstName: "Enter the first name.",
  lastName: "Enter the last name.",
  patientId: "Enter the patient ID.",
  sex: "Choose the sex.",
  dateOfBirth: "Enter a date of birth that isn't in the future.",
  consent: "The patient's consent is needed before anything is recorded.",
};

/** Registers a patient, with the same DPDP consent the mobile app asks for. */
export default function RegistrationPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", patientId: "", dateOfBirth: "", sex: "", location: "" });
  const [care, setCare] = useState(false);
  const [aiTraining, setAiTraining] = useState(false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const local = [
      !form.firstName.trim() && "firstName",
      !form.lastName.trim() && "lastName",
      !form.patientId.trim() && "patientId",
      !form.sex && "sex",
      !form.dateOfBirth && "dateOfBirth",
      !care && "consent",
    ].filter((p): p is string => typeof p === "string");
    setProblems(Object.fromEntries(local.map((p) => [p, MESSAGES[p]])));
    if (local.length) return;

    setBusy(true);
    setMessage(undefined);
    try {
      const patient = await api<PatientSummary>("/patients", {
        method: "POST",
        body: JSON.stringify({ ...form, consent: { care, aiTraining, noticeVersion: CONSENT_NOTICE_VERSION } }),
      });
      router.push(`/patients/${patient.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.problems.length) {
        setProblems(
          Object.fromEntries(
            error.problems.map((p) => [p, error.status === 409 && p === "patientId" ? "This patient ID is already registered." : MESSAGES[p] ?? "Check this field."]),
          ),
        );
      }
      setMessage(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Register a patient</h2>
          <p className="text-sm text-muted-foreground">Their wounds and visits are recorded under this patient.</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" required problem={problems["firstName"]}>
            {(id) => <input id={id} className={fieldClass} autoComplete="off" value={form.firstName} onChange={set("firstName")} />}
          </Field>
          <Field label="Last name" required problem={problems["lastName"]}>
            {(id) => <input id={id} className={fieldClass} autoComplete="off" value={form.lastName} onChange={set("lastName")} />}
          </Field>
        </div>
        <Field label="Patient ID" hint="Hospital number or MRN" required problem={problems["patientId"]}>
          {(id) => <input id={id} className={`${fieldClass} font-mono`} autoComplete="off" value={form.patientId} onChange={set("patientId")} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date of birth" required problem={problems["dateOfBirth"]}>
            {(id) => <input id={id} type="date" max={todayISO()} className={fieldClass} value={form.dateOfBirth} onChange={set("dateOfBirth")} />}
          </Field>
          <Field label="Sex" required problem={problems["sex"]}>
            {(id) => (
              <select id={id} className={fieldClass} value={form.sex} onChange={set("sex")}>
                <option value="">Choose…</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            )}
          </Field>
        </div>
        <Field label="Clinic or ward" hint="Optional">
          {(id) => <input id={id} className={fieldClass} value={form.location} onChange={set("location")} />}
        </Field>

        <fieldset className="flex flex-col gap-3 rounded-2xl border border-black/10 p-5 dark:border-white/10">
          <legend className="px-1 text-sm font-semibold">Consent</legend>
          <p className="text-sm text-muted-foreground">
            Read this to the patient or their carer and record their answers. They can withdraw consent at any time.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={care} onChange={(e) => setCare(e.target.checked)} />
            <span>
              <span className="font-medium">Care records and wound photos (required).</span>{" "}
              <span className="text-muted-foreground">Their details, wound assessments and wound photos are kept to plan and track their care.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={aiTraining} onChange={(e) => setAiTraining(e.target.checked)} />
            <span>
              <span className="font-medium">Improving wound measurement (optional).</span>{" "}
              <span className="text-muted-foreground">Wound photos, with name and other details removed, may be used to train the measurement AI.</span>
            </span>
          </label>
          {problems["consent"] && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {problems["consent"]}
            </p>
          )}
        </fieldset>

        {message && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {message}
          </p>
        )}
        <div className="flex gap-3 border-t border-black/5 pt-5 dark:border-white/10">
          <Button type="submit" disabled={busy}>
            {busy ? "Registering…" : "Register patient"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
