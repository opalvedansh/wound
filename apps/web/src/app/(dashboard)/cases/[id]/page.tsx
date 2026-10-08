'use client';

import type { CaseView, VisitView } from '@antigravity-project-spec-pack/domain/api';
import { woundTypeName } from '@antigravity-project-spec-pack/domain/wound-model';
import { AlertTriangle, Camera, CheckCheck, ChevronDown, Loader2, Printer, RotateCw, SearchX, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LineChart } from '../../../../components/charts';
import { ShareLinks } from '../../../../components/share-links';
import { Button, ButtonLink, Card, Dl, EmptyState, ErrorNote, Input, PageHeader, PageSkeleton, StatusBadge, cx } from '../../../../components/ui';
import { ReviewBadge, VisitResult } from '../../../../components/visit/VisitResult';
import { WoundImage } from '../../../../components/wound-image';
import { ApiError, errorMessage } from '../../../../lib/api';
import { dateTimeText, daysFromToday, pctText, relativeDay, shortDate, todayISO } from '../../../../lib/format';
import { useCase, useMarkReviewed, useOlderVisits, useRetryVisit, useUpdateCase } from '../../../../lib/queries';

function CasePage() {
  const { id } = useParams<{ id: string }>();
  const { data: cv, error, isPending, refetch } = useCase(id);

  if (isPending) return <PageSkeleton rows={4} />;
  if (error instanceof ApiError && error.status === 404) return <EmptyState icon={SearchX} title="Wound not found" body="It may have been deleted." />;
  if (error || !cv) return <ErrorNote error={error} onRetry={() => void refetch()} />;
  return <CaseDetail cv={cv} />;
}

function CaseDetail({ cv }: { cv: CaseView }) {
  const opened = useSearchParams().get('visit');
  const reviewed = useMarkReviewed(cv.id);
  const update = useUpdateCase(cv.id);
  const older = useOlderVisits(cv.id, cv.visits.nextCursor);
  const [openId, setOpenId] = useState<string | null>(opened);

  // The first page refreshes while a visit is analysed, so an older page can overlap it.
  const seen = new Set<string>();
  const visits = [...cv.visits.items, ...(older.data?.pages.flatMap((p) => p.items) ?? [])].filter((v) => !seen.has(v.id) && !!seen.add(v.id));
  const latest = visits.find((v) => v.status === 'ok');
  const open = openId ?? visits[0]?.id ?? null;
  const flagged = cv.status === 'overdue' || cv.status === 'review';
  const series = cv.areaSeries.map((s) => ({ label: `T${s.sequence}`, value: s.areaCm2, detail: `T${s.sequence} · ${shortDate(s.at)}` }));
  const m = latest?.findings?.measurement;
  const name = `${cv.patient.firstName} ${cv.patient.lastName}`;
  const moreOlder = older.data ? older.hasNextPage : !!cv.visits.nextCursor;

  return (
    <>
      <PageHeader
        back={{ href: `/patients/${cv.patient.id}`, label: `${name} · ${cv.patient.patientId}` }}
        title={cv.woundType === 'Not recorded' ? cv.location : cv.woundType}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{cv.location}</span>
            <span aria-hidden>·</span>
            <span>Onset {shortDate(cv.onset)}</span>
            <span aria-hidden>·</span>
            {cv.closedAt ? <span className="font-medium">Closed {shortDate(cv.closedAt)}</span> : <StatusBadge status={cv.status} />}
          </span>
        }
        actions={
          <>
            {!cv.closedAt ? (
              <ButtonLink href={`/cases/${cv.id}/visits/new`} icon={Camera}>
                New visit
              </ButtonLink>
            ) : null}
            {flagged && !cv.closedAt ? (
              cv.needsReview ? (
                <Button variant="secondary" icon={CheckCheck} disabled={reviewed.isPending} onClick={() => reviewed.mutate(true)}>
                  Mark reviewed
                </Button>
              ) : (
                <Button variant="ghost" icon={Undo2} disabled={reviewed.isPending} onClick={() => reviewed.mutate(false)}>
                  Reviewed {cv.reviewedAt ? shortDate(cv.reviewedAt) : ''}
                </Button>
              )
            ) : null}
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print report
            </Button>
          </>
        }
      />

      {cv.statusReason && !cv.closedAt ? (
        <div
          className={cx(
            'mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-sm',
            cv.status === 'overdue' ? 'bg-overdue-soft text-overdue' : cv.status === 'review' ? 'bg-review-soft text-review' : 'bg-healing-soft text-healing',
          )}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">{cv.statusReason}.</span>{' '}
            {cv.needsReview ? 'Shown in the review queue until it is reviewed.' : cv.reviewedAt ? `Marked reviewed ${shortDate(cv.reviewedAt)}.` : ''}
          </div>
        </div>
      ) : null}
      {reviewed.error ? (
        <div className="mb-4">
          <ErrorNote error={reviewed.error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card padded={false} className="overflow-hidden">
          {latest ? (
            <>
              <div className="relative">
                <WoundImage src={latest.photoUrl ?? latest.thumbUrl} outline={latest.findings?.outline} aspect={0.75} eager className="block w-full" />
                <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white">
                  T{latest.sequence} · {shortDate(latest.takenAt)}
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-hairline border-t border-hairline">
                <Metric label="Area" value={cv.latestAreaCm2 != null ? String(cv.latestAreaCm2) : '—'} unit="cm²" />
                <Metric
                  label="Since first visit"
                  value={pctText(cv.areaChangePct)}
                  tone={cv.areaChangePct === null ? undefined : cv.areaChangePct <= 0 ? 'text-healing' : 'text-overdue'}
                />
                <Metric label="Days open" value={String(Math.max(0, -daysFromToday(cv.onset)))} />
              </div>
            </>
          ) : (
            <EmptyState icon={Camera} title="No analysed photos yet" body="Measurements appear after the first visit's photo is analysed." />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Area over time" action={<span className="text-[12px] text-muted">{series.length} measured visits</span>}>
            {series.length >= 2 ? <LineChart data={series} unit="cm²" /> : <p className="py-10 text-center text-sm text-muted">Needs at least two measured visits.</p>}
          </Card>
          {m || latest ? (
            <Card title="Latest measurement">
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {(
                  [
                    ['Area', m ? `${m.area_cm2} cm²` : '—'],
                    ['Length × width', m ? `${m.length_cm} × ${m.width_cm} cm` : '—'],
                    ['Perimeter', m ? `${m.perimeter_cm} cm` : '—'],
                    ['Wound type (AI)', latest?.findings?.wound_type ? woundTypeName(latest.findings.wound_type.label) : '—'],
                    [
                      'Confidence',
                      latest?.findings?.wound_type?.rule
                        ? 'Set by rule'
                        : latest?.findings?.wound_type?.prob != null
                          ? `${Math.round(latest.findings.wound_type.prob * 100)}%`
                          : '—',
                    ],
                    ['Flags', String(latest?.findings?.flags?.length ?? 0)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-bg px-3 py-2.5">
                    <dt className="text-[12px] text-muted">{k}</dt>
                    <dd className="font-semibold tabular">{v}</dd>
                  </div>
                ))}
              </dl>
              {!m && latest?.findings?.marker_found === false ? (
                <p className="mt-3 text-[12px] text-review">Size not measured: the calibration sticker wasn&apos;t found in the photo.</p>
              ) : null}
            </Card>
          ) : null}
          {!cv.closedAt ? <NextVisit cv={cv} pending={update.isPending} onSave={(nextVisit) => update.mutate({ nextVisit })} error={update.error} /> : null}
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-[15px] font-semibold">Visits · {cv.visitCount}</h2>
      {visits.length === 0 ? (
        <Card>
          <EmptyState
            icon={Camera}
            title="No visits yet"
            body="Photograph the wound to get its first assessment."
            action={
              <ButtonLink href={`/cases/${cv.id}/visits/new`} icon={Camera}>
                New visit
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ol className="space-y-3">
          {visits.map((v) => (
            <VisitRow key={v.id} caseId={cv.id} v={v} expanded={v.id === open} onToggle={() => setOpenId(v.id === open ? '' : v.id)} />
          ))}
        </ol>
      )}
      {moreOlder ? (
        <div className="no-print mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={older.isFetching}
            onClick={() => void (older.data ? older.fetchNextPage() : older.refetch())}
          >
            {older.isFetching ? 'Loading…' : 'Show older visits'}
          </Button>
        </div>
      ) : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card title="Wound details">
          <Dl
            rows={[
              ['Wound type', cv.woundType],
              ['Location', cv.location],
              ['Onset', shortDate(cv.onset)],
              ['Comorbidities', cv.comorbidities.join(', ') || 'None recorded'],
              ['Remarks', cv.remarks || '—'],
            ]}
          />
          <div className="no-print mt-4">
            <Button
              variant={cv.closedAt ? 'secondary' : 'ghost'}
              size="sm"
              disabled={update.isPending}
              onClick={() => {
                if (cv.closedAt || window.confirm('Close this wound? It leaves the lists and the review queue. You can reopen it.')) {
                  update.mutate({ closed: !cv.closedAt });
                }
              }}
            >
              {cv.closedAt ? 'Reopen wound' : 'Close wound (healed)'}
            </Button>
          </div>
        </Card>
        <Card title="Patient">
          <Dl
            rows={[
              [
                'Name',
                <Link key="p" className="text-accent hover:underline" href={`/patients/${cv.patient.id}`}>
                  {name}
                </Link>,
              ],
              ['Patient ID', cv.patient.patientId],
              ['Visits', String(cv.visitCount)],
              ['Last visit', cv.lastVisitAt ? shortDate(cv.lastVisitAt) : '—'],
              ['Next visit', cv.nextVisitDue ? relativeDay(cv.nextVisitDue) : '—'],
            ]}
          />
        </Card>
        <div className="no-print lg:col-span-2">
          <ShareLinks caseId={cv.id} />
        </div>
      </div>

      <PrintReport cv={cv} visits={visits} />
    </>
  );
}

function Metric({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <div className={`text-[22px] font-semibold tracking-tight tabular ${tone ?? ''}`}>
        {value}
        {unit ? <span className="ml-1 text-[13px] font-normal text-muted">{unit}</span> : null}
      </div>
      <div className="text-[12px] text-muted">{label}</div>
    </div>
  );
}

function NextVisit({ cv, pending, onSave, error }: { cv: CaseView; pending: boolean; onSave: (day: string | null) => void; error: unknown }) {
  const [day, setDay] = useState(cv.nextVisitDue ?? '');
  if (cv.visitCount === 0) return null;
  return (
    <Card title="Next visit" className="no-print">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" min={todayISO()} value={day} onChange={(e) => setDay(e.target.value)} className="w-auto" aria-label="Next visit date" />
        <Button variant="secondary" disabled={pending || day === (cv.nextVisitDue ?? '')} onClick={() => onSave(day || null)}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <span className="text-[13px] text-muted">{cv.nextVisitDue ? `Due ${relativeDay(cv.nextVisitDue).toLowerCase()}` : 'Not planned'}</span>
      </div>
      {error ? <p className="mt-2 text-[13px] text-overdue">{errorMessage(error)}</p> : null}
    </Card>
  );
}

function VisitRow({ caseId, v, expanded, onToggle }: { caseId: string; v: VisitView; expanded: boolean; onToggle: () => void }) {
  const retry = useRetryVisit(caseId);
  const m = v.findings?.measurement;
  const type = v.findings?.wound_type;
  const urgent = (v.findings?.flags ?? []).some((f) => f.level === 'urgent');

  if (v.status !== 'ok') {
    return (
      <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm">
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent">T{v.sequence}</span>
        <span className="font-medium">{dateTimeText(v.takenAt)}</span>
        {v.status === 'processing' ? (
          <span className="inline-flex items-center gap-2 text-review">
            <Loader2 size={15} className="animate-spin" /> Analysing the photo…
          </span>
        ) : v.status === 'failed' ? (
          <>
            <span className="text-overdue">Analysis failed{v.error ? `: ${v.error}` : ''}</span>
            <Button variant="secondary" size="sm" icon={RotateCw} disabled={retry.isPending} onClick={() => retry.mutate(v.id)} className="ml-auto">
              Try again
            </Button>
          </>
        ) : (
          <span className="text-review">
            {v.status === 'retake' ? 'Photo couldn’t be used: ' + (v.findings?.quality?.issues?.join(' ') || 'retake it.') : 'No wound found in the photo. Retake with the whole wound in frame.'}
          </span>
        )}
      </li>
    );
  }

  return (
    <li className="print-break-avoid rounded-2xl border border-hairline bg-surface">
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left">
        <WoundImage src={v.thumbUrl ?? v.photoUrl} outline={v.findings?.outline} aspect={1} className="w-12 shrink-0 rounded-lg" />
        <span className="grid">
          <span className="text-sm font-semibold">
            T{v.sequence} · {dateTimeText(v.takenAt)}
          </span>
          <span className="text-[13px] text-muted">
            {m ? `${m.area_cm2} cm²` : 'Size not measured'}
            {type ? ` · ${woundTypeName(type.label)}` : ''}
          </span>
        </span>
        {urgent ? <span className="rounded-full bg-overdue-soft px-2 py-0.5 text-[12px] font-semibold text-overdue">Urgent flag</span> : null}
        <span className="ml-auto flex items-center gap-2">
          <ReviewBadge review={v.review} />
          <ChevronDown size={16} className={cx('transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-hairline p-4">
          <VisitResult caseId={caseId} visit={v} />
        </div>
      ) : null}
    </li>
  );
}

/** Only on paper: the visit table and the latest clinician-approved report. */
function PrintReport({ cv, visits }: { cv: CaseView; visits: VisitView[] }) {
  const ok = visits.filter((v) => v.status === 'ok');
  const approved = ok.find((v) => v.review && v.review.decision !== 'rejected' && v.review.finalReport);
  return (
    <section className="mt-10 hidden print:block">
      <h2 className="mb-2 text-[15px] font-semibold">Visit summary</h2>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1.5">Visit</th>
            <th>Date</th>
            <th className="text-right">Area cm²</th>
            <th className="text-right">L × W cm</th>
            <th>Wound type (AI)</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {ok.map((v) => {
            const m = v.findings?.measurement;
            return (
              <tr key={v.id} className="border-b">
                <td className="py-1.5">T{v.sequence}</td>
                <td>{shortDate(v.takenAt)}</td>
                <td className="text-right">{m?.area_cm2 ?? '—'}</td>
                <td className="text-right">{m ? `${m.length_cm} × ${m.width_cm}` : '—'}</td>
                <td>{v.findings?.wound_type ? woundTypeName(v.findings.wound_type.label) : '—'}</td>
                <td>{v.review ? v.review.decision : 'Awaiting review'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {approved?.review?.finalReport ? (
        <>
          <h2 className="mt-6 mb-2 text-[15px] font-semibold">Latest clinician-reviewed report (T{approved.sequence})</h2>
          <pre className="font-sans text-[12px] whitespace-pre-wrap">{approved.review.finalReport}</pre>
        </>
      ) : null}
      <p className="mt-6 text-[11px] text-muted">
        {cv.patient.patientId} · printed {shortDate(new Date().toISOString())}. Measurements are AI-assisted and reviewed by a clinician. Research prototype, not
        for patient care.
      </p>
    </section>
  );
}

export default function CaseDetailPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <CasePage />
    </Suspense>
  );
}
