'use client';

import { Activity, CalendarCheck, ClipboardCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BarList, ColumnChart, DivergingBars } from '../../../components/charts';
import { Card, ErrorNote, PageSkeleton, StatTile, StatusBadge } from '../../../components/ui';
import { WoundImage } from '../../../components/wound-image';
import { relativeDay, shortDate } from '../../../lib/format';
import { prefetchCase, useDashboard, useMe, useRole } from '../../../lib/queries';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const me = useMe();
  const role = useRole();
  // Asked for only once the role is known to be clinical (the front desk never sees it).
  const { data: d, error, refetch, isPending } = useDashboard(role === 'ADMIN' || role === 'DOCTOR');
  const router = useRouter();
  const qc = useQueryClient();

  if (isPending) return <PageSkeleton tiles={4} rows={5} />;
  if (error || !d) return <ErrorNote error={error} onRetry={() => void refetch()} />;

  const weeks = d.visitsPerWeek.map((w) => ({
    label: shortDate(w.weekStart).replace(/ \d{4}$/, ''),
    value: w.count,
    detail: `Week of ${shortDate(w.weekStart)}`,
  }));
  const diff = d.visitsThisWeek - d.visitsLastWeek;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {greeting()}
            {me.data?.firstName ? `, ${me.data.firstName}` : ''}
          </p>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">Clinic overview</h1>
        </div>
        <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Patients" value={d.patients} icon={Users} hint={`${d.openWounds} open wounds`} href="/patients" />
        <StatTile label="Open wounds" value={d.openWounds} icon={Activity} hint={`${d.shrinking} shrinking since first visit`} />
        <StatTile
          label="Visits this week"
          value={d.visitsThisWeek}
          icon={CalendarCheck}
          hint={d.visitsLastWeek || d.visitsThisWeek ? `${diff >= 0 ? '+' : ''}${diff} vs last week` : undefined}
        />
        <StatTile
          label="To review"
          value={d.draftsToReview + d.needsAttention}
          icon={ClipboardCheck}
          tone={d.urgentDrafts ? 'overdue' : d.draftsToReview + d.needsAttention ? 'review' : undefined}
          hint={`${d.draftsToReview} AI drafts${d.urgentDrafts ? ` (${d.urgentDrafts} urgent)` : ''} · ${d.needsAttention} wounds`}
          href="/review-queue"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Visits per week" action={<span className="text-[12px] text-muted">Last 8 weeks</span>}>
          <ColumnChart data={weeks} unit="visits" />
        </Card>
        <Card title="Open wounds by type">
          {d.woundTypes.length ? (
            <BarList data={d.woundTypes.map((t) => ({ label: t.label, value: t.count }))} unit="wounds" />
          ) : (
            <p className="py-10 text-center text-sm text-muted">No open wounds yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Healing progress" action={<span className="text-[12px] text-muted">Area change since first visit</span>}>
          {d.healing.length ? (
            <DivergingBars
              data={d.healing.map((h) => ({ id: h.caseId, label: h.patient, sub: h.location, value: h.changePct }))}
              onSelect={(id) => router.push(`/cases/${id}`)}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted">Appears once wounds have two measured visits.</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card
            title="Needs attention"
            action={
              <Link href="/review-queue" className="text-[13px] font-medium text-accent hover:underline">
                Open queue
              </Link>
            }
            padded={false}
          >
            <ul className="divide-y divide-hairline px-5 pb-2">
              {d.attention.map((a) => (
                <li key={a.caseId}>
                  <Link
                    href={`/cases/${a.caseId}`}
                    onMouseEnter={() => void prefetchCase(qc, a.caseId)}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-alt"
                  >
                    <WoundImage src={a.thumbUrl} aspect={1} className="w-10 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.patient}</div>
                      <div className="truncate text-[12px] text-muted">{a.reason ?? a.location}</div>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
              {d.attention.length === 0 ? <li className="py-6 text-center text-sm text-muted">Nothing needs attention.</li> : null}
            </ul>
          </Card>

          <Card title="Upcoming visits" action={<span className="text-[12px] text-muted">Next 7 days</span>} padded={false}>
            <ul className="divide-y divide-hairline px-5 pb-2">
              {d.upcoming.map((u) => (
                <li key={u.caseId}>
                  <Link href={`/cases/${u.caseId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-alt">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{u.patient}</div>
                      <div className="truncate text-[12px] text-muted">{u.location}</div>
                    </div>
                    <span className="text-[13px] font-medium whitespace-nowrap">{relativeDay(u.due)}</span>
                  </Link>
                </li>
              ))}
              {d.upcoming.length === 0 ? <li className="py-6 text-center text-sm text-muted">No visits in the next week.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
