'use client';

import type { AttentionItem, DraftItem, QueueView } from '@antigravity-project-spec-pack/domain/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, CheckCheck, ClipboardCheck, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button, Chip, cx, EmptyState, ErrorNote, PageHeader, PageSkeleton, StatusBadge } from '../../../components/ui';
import { WoundImage } from '../../../components/wound-image';
import { send } from '../../../lib/api';
import { dateTimeText, relativeDay, shortDate } from '../../../lib/format';
import { keys, prefetchCase, useQueue, useQueueCounts } from '../../../lib/queries';

const VIEWS: { value: QueueView; label: string; empty: string }[] = [
  { value: 'drafts', label: 'AI drafts', empty: 'Every AI draft has been reviewed.' },
  { value: 'attention', label: 'Wounds to review', empty: 'No wounds need attention right now.' },
  { value: 'overdue', label: 'Overdue', empty: 'No overdue visits.' },
  { value: 'review', label: 'Needs review', empty: 'No wounds flagged for review.' },
  { value: 'reviewed', label: 'Reviewed', empty: 'Wounds you mark as reviewed appear here.' },
];

/** One worklist: AI drafts awaiting a clinician, and wounds that are overdue or need review (same rule as the app). */
function Queue() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = (VIEWS.find((v) => v.value === params.get('view'))?.value ?? 'drafts') as QueueView;
  const counts = useQueueCounts();
  const queue = useQueue(view);
  const qc = useQueryClient();
  const items = queue.data?.pages.flatMap((p) => p.items) ?? [];

  // Optimistic: the wound leaves this list at once; the counts and lists refresh after the server agrees.
  const mark = useMutation({
    mutationFn: ({ caseId, reviewed }: { caseId: string; reviewed: boolean }) => send(`/cases/${caseId}/reviewed`, 'POST', { reviewed }),
    onMutate: async ({ caseId }) => {
      await qc.cancelQueries({ queryKey: keys.queue(view) });
      const before = qc.getQueryData(keys.queue(view));
      qc.setQueryData<typeof queue.data>(keys.queue(view), (d) =>
        d ? { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((i) => !('status' in i) || i.caseId !== caseId) })) } : d,
      );
      return { before };
    },
    onError: (_e, _v, ctx) => ctx?.before && qc.setQueryData(keys.queue(view), ctx.before),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.all() }),
  });

  const n = (v: QueueView) => counts.data?.[v];

  return (
    <>
      <PageHeader title="Review queue" subtitle="AI drafts to approve, overdue visits and wounds that are getting worse." />
      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Chip key={v.value} selected={view === v.value} onClick={() => router.replace(`${pathname}?view=${v.value}`, { scroll: false })}>
            {v.label}
            {n(v.value) !== undefined ? ` · ${n(v.value)}` : ''}
          </Chip>
        ))}
      </div>
      {mark.error ? (
        <div className="mb-3">
          <ErrorNote error={mark.error} />
        </div>
      ) : null}

      {queue.isPending ? (
        <PageSkeleton rows={6} />
      ) : queue.isError ? (
        <ErrorNote error={queue.error} onRetry={() => void queue.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface">
          <EmptyState icon={ClipboardCheck} title={view === 'reviewed' ? 'Nothing reviewed yet' : 'All caught up'} body={VIEWS.find((v) => v.value === view)?.empty} />
        </div>
      ) : (
        <ul className={cx('space-y-3 transition-opacity', queue.isPlaceholderData && 'opacity-60')}>
          {items.map((item) =>
            'visitId' in item ? (
              <Draft key={item.visitId} d={item} onHover={() => void prefetchCase(qc, item.caseId)} />
            ) : (
              <Wound
                key={item.caseId}
                a={item}
                onHover={() => void prefetchCase(qc, item.caseId)}
                busy={mark.isPending && mark.variables?.caseId === item.caseId}
                onMark={(reviewed) => mark.mutate({ caseId: item.caseId, reviewed })}
              />
            ),
          )}
        </ul>
      )}
      {queue.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" disabled={queue.isFetchingNextPage} onClick={() => void queue.fetchNextPage()}>
            {queue.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Draft({ d, onHover }: { d: DraftItem; onHover: () => void }) {
  return (
    <li>
      <Link
        href={`/cases/${d.caseId}?visit=${d.visitId}`}
        onMouseEnter={onHover}
        className={cx(
          'flex items-center gap-4 rounded-2xl border bg-surface p-4 transition-colors hover:border-accent/40',
          d.urgent ? 'border-overdue/40' : 'border-hairline',
        )}
      >
        <WoundImage src={d.thumbUrl} aspect={1} className="w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{d.patient}</span>
            {d.urgent ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-overdue-soft px-2 py-0.5 text-[12px] font-semibold text-overdue">
                <AlertOctagon size={12} /> Urgent
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[13px] text-ink-soft">{d.location}</div>
          <div className="mt-1 text-[13px] text-muted">
            {dateTimeText(d.takenAt)} · {d.areaCm2 !== null ? `${d.areaCm2} cm²` : 'size not measured'}
            {d.flagCount ? ` · ${d.flagCount} flag${d.flagCount > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <span className="hidden text-[13px] font-medium text-accent sm:block">Review draft →</span>
      </Link>
    </li>
  );
}

function Wound({ a, onHover, onMark, busy }: { a: AttentionItem; onHover: () => void; onMark: (reviewed: boolean) => void; busy: boolean }) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-4 sm:flex-row sm:items-center">
      <Link href={`/cases/${a.caseId}`} onMouseEnter={onHover} className="flex min-w-0 flex-1 items-center gap-4">
        <WoundImage src={a.thumbUrl} aspect={1} className="w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.patient}</span>
            <StatusBadge status={a.status} />
          </div>
          <div className="mt-0.5 text-[13px] text-ink-soft">{a.location}</div>
          {a.reason ? <div className="mt-1 text-[13px] font-medium">{a.reason}</div> : null}
        </div>
      </Link>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-right text-[12px] text-muted">
          <div>Last visit {a.lastVisitAt ? shortDate(a.lastVisitAt) : '—'}</div>
          <div>Due {a.nextVisitDue ? relativeDay(a.nextVisitDue).toLowerCase() : '—'}</div>
        </div>
        {a.reviewedAt ? (
          <Button variant="ghost" size="sm" icon={Undo2} disabled={busy} onClick={() => onMark(false)}>
            Reviewed {shortDate(a.reviewedAt)}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" icon={CheckCheck} disabled={busy} onClick={() => onMark(true)}>
            Mark reviewed
          </Button>
        )}
      </div>
    </li>
  );
}

export default function ReviewQueuePage() {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Queue />
    </Suspense>
  );
}
