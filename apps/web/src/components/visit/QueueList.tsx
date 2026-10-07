import Link from "next/link";
import { AlertOctagon, ArrowRight } from "lucide-react";
import type { QueueItem } from "@antigravity-project-spec-pack/domain/wound-model";
import { dateTimeText } from "../../lib/format";

/** Drafts awaiting a clinician, urgent ones first. Each opens its visit on the wound's page. */
export function QueueList({ items }: { items: QueueItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.aiResultId}>
          <Link
            href={`/cases/${item.caseId}?visit=${item.aiResultId}`}
            className={`flex items-center gap-4 rounded-2xl border bg-white px-4 py-3 transition-colors hover:bg-black/[0.02] dark:bg-black/20 ${
              item.urgentFlags ? "border-red-300 dark:border-red-900" : "border-black/10 dark:border-white/10"
            }`}
          >
            {item.urgentFlags > 0 && <AlertOctagon className="h-5 w-5 shrink-0 text-red-600" aria-label="Urgent flag" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {item.patient.firstName} {item.patient.lastName} · {item.caseLocation}
              </span>
              <span className="block text-sm text-muted-foreground">
                {dateTimeText(item.takenAt)} · {item.areaCm2 !== null ? `${item.areaCm2} cm²` : "size not measured"}
                {item.urgentFlags > 0 && <span className="font-semibold text-red-700"> · {item.urgentFlags} urgent</span>}
                {item.reviewFlags > 0 && ` · ${item.reviewFlags} to review`}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
