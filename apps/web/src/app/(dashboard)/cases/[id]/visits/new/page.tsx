"use client"
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  missingIntake,
  type CaseView,
  type IntakeAnswers,
  type IntakeQuestion,
  type VisitOutcome,
} from "@antigravity-project-spec-pack/domain/wound-model";
import { Button } from "../../../../../../components/ui/button";
import { PageNote } from "../../../../../../components/ui/field";
import { IntakeForm, bodySiteFor } from "../../../../../../components/visit/IntakeForm";
import { PhotoStep } from "../../../../../../components/visit/PhotoStep";
import { api, errorMessage, useApi } from "../../../../../../lib/api";

/** Photograph a wound, answer the model's questions, and get an AI draft to review. */
export default function NewVisitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const woundCase = useApi<CaseView>(`/cases/${id}`);
  const core = useApi<IntakeQuestion[]>("/model/intake-questions");

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [followUps, setFollowUps] = useState<IntakeQuestion[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [retake, setRetake] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const top = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  // Pre-fill what the record already says: the body site from the wound's location, diabetes from comorbidities.
  useEffect(() => {
    if (prefilled.current || !woundCase.data || !core.data) return;
    prefilled.current = true;
    const site = bodySiteFor(woundCase.data.location, core.data.find((q) => q.id === "body_location")?.options);
    const diabetic = woundCase.data.comorbidities.some((c) => /diabet/i.test(c));
    setAnswers((a) => ({ ...(site ? { body_location: site } : {}), ...(diabetic ? { diabetes: "yes" } : {}), ...a }));
  }, [woundCase.data, core.data]);

  // Follow-ups (burn, surgical, pressure, diabetic foot) depend only on these two answers. Only they are sent,
  // because the model leaves out follow-ups that are already answered, and they would vanish from the form.
  const cause = answers["cause"];
  const diabetes = answers["diabetes"];
  useEffect(() => {
    if (cause === undefined && diabetes === undefined) return setFollowUps([]);
    let cancelled = false;
    api<IntakeQuestion[]>("/model/follow-ups", {
      method: "POST",
      body: JSON.stringify({ ...(cause !== undefined ? { cause } : {}), ...(diabetes !== undefined ? { diabetes } : {}) }),
    })
      .then((questions) => !cancelled && setFollowUps(questions))
      .catch(() => undefined); // the core questions are enough to analyse
    return () => {
      cancelled = true;
    };
  }, [cause, diabetes]);

  const submit = async () => {
    const unanswered = missingIntake(answers);
    setMissing(unanswered);
    if (!photo) return setProblem("Take a photo of the wound first.");
    if (unanswered.length) return setProblem("Answer the required questions.");

    setBusy(true);
    setProblem(undefined);
    const form = new FormData();
    form.append("photo", photo, "wound.jpg");
    form.append("intake", JSON.stringify(answers));
    try {
      const outcome = await api<VisitOutcome>(`/cases/${id}/visits`, { method: "POST", body: form });
      if (outcome.status === "ok" && outcome.visit) {
        router.push(`/cases/${id}?visit=${outcome.visit.aiResultId}`);
        return;
      }
      // Nothing was saved: show why and ask for another photo. The answers are kept.
      setRetake(
        outcome.status === "retake"
          ? outcome.issues?.length
            ? outcome.issues
            : ["The photo could not be used."]
          : [...(outcome.flags ?? []).map((f) => f.text), "Make sure the whole wound is in the frame, then retake."],
      );
      setPhoto(null);
      top.current?.scrollIntoView({ behavior: "smooth" });
      setBusy(false);
    } catch (e) {
      setProblem(errorMessage(e));
      setBusy(false);
    }
  };

  if (woundCase.error) return <PageNote tone="error">{woundCase.error.message}</PageNote>;

  return (
    <div ref={top} className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <Link href={`/cases/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to the wound
        </Link>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">New visit</h2>
        {woundCase.data && (
          <p className="text-sm text-muted-foreground">
            {woundCase.data.location} · {woundCase.data.patient.firstName} {woundCase.data.patient.lastName}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">1. Photo</h3>
        <PhotoStep photo={photo} onPhoto={(p) => (setPhoto(p), setRetake(undefined))} issues={retake} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">2. Questions</h3>
        <p className="-mt-2 text-sm text-muted-foreground">A photo can't show fever, diabetes or how the wound started; these answers change the assessment.</p>
        {core.loading ? (
          <PageNote>Loading the questions…</PageNote>
        ) : core.error ? (
          <PageNote tone="error">
            The wound model isn't available: {core.error.message}{" "}
            <button type="button" className="underline" onClick={() => void core.reload()}>
              Try again
            </button>
          </PageNote>
        ) : (
          <>
            <IntakeForm questions={core.data ?? []} answers={answers} onChange={setAnswers} missing={missing} />
            {followUps.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-black/5 pt-5 dark:border-white/10">
                <p className="text-sm font-semibold">A few more questions</p>
                <IntakeForm questions={followUps} answers={answers} onChange={setAnswers} />
              </div>
            )}
          </>
        )}
      </section>

      <div className="flex flex-col gap-2 border-t border-black/5 pt-6 dark:border-white/10">
        {problem && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {problem}
          </p>
        )}
        <Button type="button" size="lg" className="self-start" disabled={busy || !core.data} onClick={() => void submit()}>
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing…
            </>
          ) : (
            "Analyse photo"
          )}
        </Button>
        {busy && <p className="text-xs text-muted-foreground">This can take up to a minute if the model was asleep.</p>}
      </div>
    </div>
  );
}
