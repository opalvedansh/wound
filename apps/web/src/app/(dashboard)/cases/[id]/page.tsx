"use client"
import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, ChevronDown } from "lucide-react";
import { woundTypeName, type CaseView, type ReviewView } from "@antigravity-project-spec-pack/domain/wound-model";
import { Button } from "../../../../components/ui/button";
import { PageNote } from "../../../../components/ui/field";
import { AreaTrend, ReviewBadge, VisitResult } from "../../../../components/visit/VisitResult";
import { useApi } from "../../../../lib/api";
import { dateText, dateTimeText } from "../../../../lib/format";

function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const justAdded = useSearchParams().get("visit");
  const { data: woundCase, error, loading, setData } = useApi<CaseView>(`/cases/${id}`);
  const [openId, setOpenId] = useState<string | null>(justAdded);

  if (loading && !woundCase) return <PageNote>Loading the wound…</PageNote>;
  if (error || !woundCase) return <PageNote tone="error">{error?.message ?? "Case not found."}</PageNote>;

  const visits = [...woundCase.visits].reverse(); // newest first
  const open = openId ?? visits[0]?.aiResultId ?? null;

  const reviewed = (aiResultId: string, review: ReviewView) =>
    setData({ ...woundCase, visits: woundCase.visits.map((v) => (v.aiResultId === aiResultId ? { ...v, review } : v)) });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/patients/${woundCase.patient.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> {woundCase.patient.firstName} {woundCase.patient.lastName} · ID {woundCase.patient.patientId}
          </Link>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{woundCase.location}</h2>
          <p className="text-sm text-muted-foreground">
            Onset {dateText(woundCase.onset)}
            {woundCase.woundType !== "Not recorded" && ` · ${woundCase.woundType}`}
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href={`/cases/${id}/visits/new`}>
            <Camera className="w-4 h-4 mr-2" /> New visit
          </Link>
        </Button>
      </div>

      <AreaTrend visits={woundCase.visits} />

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">
          Visits <span className="font-normal text-muted-foreground">{visits.length}</span>
        </h3>
        {visits.length === 0 && <PageNote>No visits yet. Photograph the wound to get its first assessment.</PageNote>}
        {visits.map((visit) => {
          const expanded = visit.aiResultId === open;
          const m = visit.findings.measurement;
          const type = visit.findings.wound_type;
          return (
            <article key={visit.aiResultId} className="rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/20">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? "" : visit.aiResultId)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold">{dateTimeText(visit.takenAt)}</span>
                <span className="text-sm text-muted-foreground">{m ? `${m.area_cm2} cm²` : "Size not measured"}</span>
                {type && <span className="text-sm text-muted-foreground">{woundTypeName(type.label)}</span>}
                {(visit.findings.flags ?? []).some((f) => f.level === "urgent") && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Urgent flag</span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  <ReviewBadge review={visit.review} />
                  <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </span>
              </button>
              {expanded && (
                <div className="border-t border-black/5 p-4 dark:border-white/10">
                  <VisitResult
                    visit={visit}
                    onReviewed={(review) => reviewed(visit.aiResultId, review)}
                    onDeleted={() => setData({ ...woundCase, visits: woundCase.visits.filter((v) => v.aiResultId !== visit.aiResultId) })}
                  />
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

export default function CaseDetailPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<PageNote>Loading the wound…</PageNote>}>
      <CaseDetail />
    </Suspense>
  );
}
