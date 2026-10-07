"use client"
import Link from "next/link";
import { Camera, UserPlus } from "lucide-react";
import type { Overview } from "@antigravity-project-spec-pack/domain/wound-model";
import { Button } from "../../../components/ui/button";
import { PageNote } from "../../../components/ui/field";
import { QueueList } from "../../../components/visit/QueueList";
import { useApi } from "../../../lib/api";

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "urgent" }) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        tone === "urgent" && value > 0 ? "border-red-300 bg-red-50 text-red-900" : "border-black/10 bg-white dark:border-white/10 dark:bg-black/20"
      }`}
    >
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, error, loading } = useApi<Overview>("/overview");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Today</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your patients, and the AI drafts waiting for your review</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/registration">
              <UserPlus className="w-4 h-4 mr-2" /> Register patient
            </Link>
          </Button>
          <Button asChild>
            <Link href="/patients">
              <Camera className="w-4 h-4 mr-2" /> New visit
            </Link>
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <PageNote>Loading…</PageNote>
      ) : error || !data ? (
        <PageNote tone="error">{error?.message ?? "Couldn't load the dashboard."}</PageNote>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Patients" value={data.patients} />
            <Stat label="Wounds" value={data.openWounds} />
            <Stat label="Visits this week" value={data.visitsThisWeek} />
            <Stat label={data.urgentAwaitingReview ? `Awaiting review (${data.urgentAwaitingReview} urgent)` : "Awaiting review"} value={data.awaitingReview} tone={data.urgentAwaitingReview ? "urgent" : "default"} />
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Awaiting review</h3>
              {data.queue.length > 5 && (
                <Link href="/review-queue" className="text-sm font-medium text-primary hover:underline">
                  All {data.queue.length}
                </Link>
              )}
            </div>
            {data.queue.length === 0 ? <PageNote>Nothing to review. Every AI draft has a clinician's decision.</PageNote> : <QueueList items={data.queue.slice(0, 5)} />}
          </section>
        </>
      )}
    </div>
  );
}
