'use client';

import type { AuditItem } from '@antigravity-project-spec-pack/domain/api';
import { History } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Chip, cx, EmptyState, ErrorNote, PageHeader, PageSkeleton } from '../../../components/ui';
import { dateTimeText } from '../../../lib/format';
import { useAudit, useRole } from '../../../lib/queries';

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'patient.', label: 'Patients' },
  { value: 'case.', label: 'Wounds' },
  { value: 'visit.', label: 'Visits & reviews' },
  { value: 'share.', label: 'Share links' },
  { value: 'export.', label: 'Exports' },
  { value: 'member.', label: 'Members' },
];

const ACTION_TEXT: Record<string, string> = {
  'patient.create': 'Registered a patient',
  'patient.update': 'Edited patient details',
  'patient.delete': 'Deleted a patient',
  'case.create': 'Added a wound',
  'case.update': 'Edited a wound',
  'case.reviewed': 'Marked a wound reviewed',
  'case.unreviewed': 'Undid a review mark',
  'visit.create': 'Added a visit photo',
  'visit.review': 'Reviewed an AI draft',
  'visit.delete': 'Deleted a visit',
  'share.create': 'Created a share link',
  'share.revoke': 'Revoked a share link',
  'share.view': 'Share link opened',
  'export.patients': 'Exported patients CSV',
  'export.visits': 'Exported visits CSV',
  'member.invite': 'Invited a member',
  'member.update': 'Changed a member',
  'clinic.rename': 'Renamed the clinic',
};

const detailText = (d: Record<string, unknown> | null) =>
  d
    ? Object.entries(d)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : String(v)}`)
        .join(' · ')
    : '';

const link = (a: AuditItem) =>
  a.entity === 'Case' && a.entityId && !a.action.endsWith('delete')
    ? `/cases/${a.entityId}`
    : a.entity === 'Patient' && a.entityId && !a.action.endsWith('delete')
      ? `/patients/${a.entityId}`
      : null;

/** Append-only record of who did what in this clinic. Never edited, never deleted with the data it describes. */
export default function AuditPage() {
  const [filter, setFilter] = useState('');
  const audit = useAudit(filter, useRole() === 'ADMIN');
  const items = audit.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who did what, and when. Kept for the clinic's records; entries can't be edited." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {audit.isPending ? (
        <PageSkeleton rows={10} />
      ) : audit.isError ? (
        <ErrorNote error={audit.error} onRetry={() => void audit.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface">
          <EmptyState icon={History} title="Nothing recorded yet" />
        </div>
      ) : (
        <div className={cx('overflow-x-auto rounded-2xl border border-hairline bg-surface transition-opacity', audit.isPlaceholderData && 'opacity-60')}>
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-hairline text-[12px] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">What</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {items.map((a) => {
                const href = link(a);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft tabular">{dateTimeText(a.at)}</td>
                    <td className="px-4 py-2.5">{a.user ?? <span className="text-muted">Public link</span>}</td>
                    <td className="px-4 py-2.5">
                      {href ? (
                        <Link href={href} className="text-accent hover:underline">
                          {ACTION_TEXT[a.action] ?? a.action}
                        </Link>
                      ) : (
                        (ACTION_TEXT[a.action] ?? a.action)
                      )}
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-2.5 text-[13px] text-muted" title={detailText(a.details)}>
                      {detailText(a.details) || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {audit.hasNextPage ? (
            <div className="flex justify-center border-t border-hairline p-3">
              <Button variant="ghost" size="sm" disabled={audit.isFetchingNextPage} onClick={() => void audit.fetchNextPage()}>
                {audit.isFetchingNextPage ? 'Loading…' : 'Load older entries'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
