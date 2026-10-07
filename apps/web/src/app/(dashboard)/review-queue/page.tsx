"use client"
import type { Overview } from "@antigravity-project-spec-pack/domain/wound-model";
import { PageNote } from "../../../components/ui/field";
import { QueueList } from "../../../components/visit/QueueList";
import { useApi } from "../../../lib/api";

/** Every AI draft without a clinician's decision, urgent first. Nothing reaches the record until it is reviewed. */
export default function ReviewQueuePage() {
  const { data, error, loading } = useApi<Overview>("/overview");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Review queue</h2>
        <p className="mt-1 text-sm text-muted-foreground">AI drafts waiting for you to approve, edit or reject, urgent first</p>
      </div>
      {loading && !data ? (
        <PageNote>Loading…</PageNote>
      ) : error || !data ? (
        <PageNote tone="error">{error?.message ?? "Couldn't load the queue."}</PageNote>
      ) : data.queue.length === 0 ? (
        <PageNote>Nothing to review. Every AI draft has a clinician's decision.</PageNote>
      ) : (
        <QueueList items={data.queue} />
      )}
    </div>
  );
}
