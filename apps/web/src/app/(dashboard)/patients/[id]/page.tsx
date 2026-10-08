'use client';

import type { CaseCard, PatientDetail } from '@antigravity-project-spec-pack/domain/api';
import { WOUND_TYPE_LABEL } from '@antigravity-project-spec-pack/domain/wound-model';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Lock, Pencil, Plus, Printer, Trash2, UserX, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Dl,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  PageSkeleton,
  StatusBadge,
  inputCls,
} from '../../../../components/ui';
import { WoundImage } from '../../../../components/wound-image';
import { ApiError, errorMessage } from '../../../../lib/api';
import { ageOf, pctText, relativeDay, SEX_NAME, shortDate, todayISO } from '../../../../lib/format';
import { prefetchCase, useCreateCase, useDeletePatient, usePatient, useRole, useUpdatePatient } from '../../../../lib/queries';

export default function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useRole();
  const { data: p, error, isPending, refetch } = usePatient(id);
  const remove = useDeletePatient();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  if (isPending) return <PageSkeleton rows={4} />;
  if (error instanceof ApiError && error.status === 404) return <EmptyState icon={UserX} title="Patient not found" body="It may have been deleted." />;
  if (error || !p) return <ErrorNote error={error} onRetry={() => void refetch()} />;

  const name = `${p.firstName} ${p.lastName}`;
  const age = ageOf(p);
  const clinical = role === 'ADMIN' || role === 'DOCTOR';
  const consent: [string, boolean | undefined][] = p.consent
    ? [
        ['Treatment', p.consent.care],
        ['Wound photos', p.consent.photos],
        ['Location stamp', p.consent.location],
        ['AI training', p.consent.aiTraining],
      ]
    : [];

  const deletePatient = () => {
    if (!window.confirm(`Delete ${name} with every wound, visit and photo? This can't be undone.`)) return;
    remove.mutate(p.id, { onSuccess: () => router.replace('/patients') });
  };

  return (
    <>
      <PageHeader
        back={{ href: '/patients', label: 'Patients' }}
        title={name}
        subtitle={[p.patientId, age !== null ? `${age} years` : null, SEX_NAME[p.sex] ?? p.sex].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing((e) => !e)}>
              Edit
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print summary
            </Button>
            {clinical ? (
              <Button variant="danger" icon={Trash2} disabled={remove.isPending} onClick={deletePatient}>
                {remove.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            ) : null}
          </>
        }
      />
      {remove.error ? (
        <div className="mb-4">
          <ErrorNote error={remove.error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          {editing ? (
            <EditProfile p={p} onDone={() => setEditing(false)} />
          ) : (
            <Card>
              <div className="mb-4 flex items-center gap-3">
                <Avatar name={name} size={48} />
                <div>
                  <div className="font-semibold">{name}</div>
                  <div className="text-[13px] text-muted">Registered {shortDate(p.createdAt)}</div>
                </div>
              </div>
              <Dl
                rows={[
                  ['Patient ID', p.patientId],
                  ['Sex', SEX_NAME[p.sex] ?? p.sex],
                  [p.dateOfBirth ? 'Date of birth' : 'Age', p.dateOfBirth ? shortDate(p.dateOfBirth) : age !== null ? `${age} years` : '—'],
                  ['Mobile', p.mobile ?? '—'],
                  ['Town / area', p.location ?? '—'],
                  ['Referral', p.referral ?? '—'],
                ]}
              />
            </Card>
          )}
          <Card title="Consent (DPDP)">
            {p.consent ? (
              <>
                <ul className="space-y-2.5 text-sm">
                  {consent.map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span>{k}</span>
                      <span className={`inline-flex items-center gap-1 text-[13px] font-medium ${v ? 'text-healing' : 'text-muted'}`}>
                        {v ? <Check size={14} /> : <X size={14} />}
                        {v ? 'Given' : 'Not given'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12px] text-muted">
                  Recorded {shortDate(p.consent.recordedAt)} · notice {p.consent.noticeVersion}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">No consent recorded.</p>
            )}
          </Card>
          {p.notes ? (
            <Card title="Notes">
              <p className="text-sm whitespace-pre-wrap">{p.notes}</p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Wounds{p.cases ? ` · ${p.cases.length}` : ''}</h2>
            {clinical && !adding ? (
              <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAdding(true)} className="no-print">
                New wound
              </Button>
            ) : null}
          </div>
          {adding ? <NewWound patientId={p.id} onCancel={() => setAdding(false)} /> : null}
          {p.cases === null ? (
            <Card>
              <EmptyState icon={Lock} title="Clinical details are for doctors" body="Wounds, photos and reports are shown to doctors and admins." />
            </Card>
          ) : p.cases.length === 0 && !adding ? (
            <Card>
              <EmptyState icon={UserX} title="No wounds recorded yet" body="Add a wound, then photograph it at each visit." />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {p.cases.map((c) => (
                <WoundCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function WoundCard({ c }: { c: CaseCard }) {
  const qc = useQueryClient();
  return (
    <Link
      href={`/cases/${c.id}`}
      onMouseEnter={() => void prefetchCase(qc, c.id)}
      onFocus={() => void prefetchCase(qc, c.id)}
      className="group print-break-avoid overflow-hidden rounded-2xl border border-hairline bg-surface transition-colors hover:border-accent/40"
    >
      <WoundImage src={c.thumbUrl} outline={c.outline} aspect={0.6} className="block w-full" />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold group-hover:text-accent">{c.woundType}</div>
            <div className="truncate text-[13px] text-muted">{c.location}</div>
          </div>
          {c.closedAt ? <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[12px] font-medium text-muted">Closed</span> : <StatusBadge status={c.status} />}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-bg py-2">
            <div className="font-semibold tabular">{c.latestAreaCm2 ?? '—'}</div>
            <div className="text-[11px] text-muted">cm² now</div>
          </div>
          <div className="rounded-lg bg-bg py-2">
            <div className={`font-semibold tabular ${c.areaChangePct === null ? '' : c.areaChangePct <= 0 ? 'text-healing' : 'text-overdue'}`}>{pctText(c.areaChangePct)}</div>
            <div className="text-[11px] text-muted">since start</div>
          </div>
          <div className="rounded-lg bg-bg py-2">
            <div className="font-semibold tabular">{c.visitCount}</div>
            <div className="text-[11px] text-muted">visits</div>
          </div>
        </div>
        <div className="text-[12px] text-muted">
          {c.lastVisitAt ? `Last visit ${relativeDay(c.lastVisitAt).toLowerCase()}` : 'No visits yet'}
          {c.nextVisitDue ? ` · next ${relativeDay(c.nextVisitDue).toLowerCase()}` : ''}
        </div>
      </div>
    </Link>
  );
}

const WOUND_TYPES = Object.entries(WOUND_TYPE_LABEL)
  .filter(([k]) => k !== 'not_wound')
  .map(([, v]) => v);

function NewWound({ patientId, onCancel }: { patientId: string; onCancel: () => void }) {
  const router = useRouter();
  const create = useCreateCase();
  const [form, setForm] = useState({ location: '', onset: '', woundType: '', comorbidities: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => (setForm((f) => ({ ...f, [k]: v })), setErrors((e) => ({ ...e, [k]: '' })));

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.location.trim()) err['location'] = 'Enter where the wound is.';
    if (!form.onset) err['onset'] = 'Enter when it started.';
    setErrors(err);
    if (Object.keys(err).length) return;
    create.mutate(
      {
        patientId,
        location: form.location.trim(),
        onset: form.onset,
        woundType: form.woundType.trim() || undefined,
        comorbidities: form.comorbidities.split(',').map((s) => s.trim()).filter(Boolean),
      },
      { onSuccess: (cv) => router.push(`/cases/${cv.id}`) },
    );
  };

  return (
    <Card title="New wound">
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Location" required hint="Side and body site, e.g. Left heel" error={errors['location']}>
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} autoFocus />
        </Field>
        <Field label="Onset date" required error={errors['onset']}>
          <Input type="date" max={todayISO()} value={form.onset} onChange={(e) => set('onset', e.target.value)} />
        </Field>
        <Field label="Wound type" hint="Optional; the model suggests one at the first visit">
          <Input list="wound-types" value={form.woundType} onChange={(e) => set('woundType', e.target.value)} />
          <datalist id="wound-types">
            {WOUND_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Comorbidities" hint="Comma separated, e.g. Diabetes, Hypertension">
          <Input value={form.comorbidities} onChange={(e) => set('comorbidities', e.target.value)} />
        </Field>
        {create.error ? (
          <p role="alert" className="text-[13px] text-overdue sm:col-span-2">
            {errorMessage(create.error)}
          </p>
        ) : null}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Add wound'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EditProfile({ p, onDone }: { p: PatientDetail; onDone: () => void }) {
  const update = useUpdatePatient(p.id);
  const [form, setForm] = useState({
    firstName: p.firstName,
    lastName: p.lastName,
    mobile: p.mobile ?? '',
    location: p.location ?? '',
    referral: p.referral ?? '',
    notes: p.notes ?? '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const problems = update.error instanceof ApiError ? update.error.problems : [];

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    update.mutate(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobile: form.mobile.trim() || null,
        location: form.location.trim() || null,
        referral: form.referral.trim() || null,
        notes: form.notes.trim() || null,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <Card title="Edit details">
      <form onSubmit={submit} noValidate className="space-y-3">
        <Field label="First name" error={problems.includes('firstName') ? 'Required' : undefined}>
          <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Last name" error={problems.includes('lastName') ? 'Required' : undefined}>
          <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Mobile" error={problems.includes('mobile') ? 'Enter a valid phone number' : undefined}>
          <Input inputMode="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <Field label="Town / area">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Referral">
          <Input value={form.referral} onChange={(e) => set('referral', e.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={`${inputCls} h-auto py-2`} />
        </Field>
        {update.error && !problems.length ? <p className="text-[13px] text-overdue">{errorMessage(update.error)}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
