'use client';

import type { ClinicRole, Member } from '@antigravity-project-spec-pack/domain/api';
import { Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, PageSkeleton, Segmented, cx } from '../../../../components/ui';
import { ApiError, errorMessage } from '../../../../lib/api';
import { shortDate } from '../../../../lib/format';
import { useInvite, useMe, useMembers, useRole, useUpdateMember } from '../../../../lib/queries';

const ROLES: { value: ClinicRole; label: string; what: string }[] = [
  { value: 'ADMIN', label: 'Admin', what: 'Everything, plus members, exports and the audit log.' },
  { value: 'DOCTOR', label: 'Doctor', what: 'Patients, wounds, photos, AI drafts and reviews.' },
  { value: 'FRONT_DESK', label: 'Front desk', what: 'Registers patients and edits their details. No clinical data.' },
];

/** Who can sign in to this clinic, and what each person may see. Changes apply on their next request. */
export default function MembersPage() {
  const me = useMe();
  const members = useMembers(useRole() === 'ADMIN');
  const update = useUpdateMember();
  const [inviting, setInviting] = useState(false);

  if (members.isPending) return <PageSkeleton rows={5} />;
  if (members.isError) return <ErrorNote error={members.error} onRetry={() => void members.refetch()} />;

  const list = members.data;
  const active = list.filter((m) => m.active);

  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle={`${active.length} active member${active.length === 1 ? '' : 's'}`}
        actions={
          !inviting ? (
            <Button icon={UserPlus} onClick={() => setInviting(true)}>
              Invite member
            </Button>
          ) : null
        }
      />
      {inviting ? <Invite onDone={() => setInviting(false)} /> : null}
      {update.error ? (
        <div className="mb-4">
          <ErrorNote error={update.error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          {list.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No members yet" />
          ) : (
            <ul className="divide-y divide-hairline">
              {list.map((m) => (
                <MemberRow
                  key={m.id}
                  m={m}
                  self={m.userId === me.data?.id}
                  busy={update.isPending && update.variables?.id === m.id}
                  onChange={(body) => update.mutate({ id: m.id, ...body })}
                />
              ))}
            </ul>
          )}
        </div>
        <Card title="Roles">
          <ul className="space-y-3 text-sm">
            {ROLES.map((r) => (
              <li key={r.value}>
                <div className="font-medium">{r.label}</div>
                <div className="text-[13px] text-muted">{r.what}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-muted">A clinic always keeps at least one active admin.</p>
        </Card>
      </div>
    </>
  );
}

function MemberRow({
  m,
  self,
  busy,
  onChange,
}: {
  m: Member;
  self: boolean;
  busy: boolean;
  onChange: (body: { role?: ClinicRole; active?: boolean }) => void;
}) {
  return (
    <li className={cx('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center', !m.active && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={m.name || m.email} size={36} />
        <div className="min-w-0 leading-tight">
          <div className="truncate font-medium">
            {m.name || m.email}
            {self ? <span className="ml-2 text-[12px] font-normal text-muted">(you)</span> : null}
          </div>
          <div className="truncate text-[12px] text-muted">
            {m.email} · since {shortDate(m.createdAt)}
            {!m.active ? ' · deactivated' : ''}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Role of ${m.email}`}
          value={m.role}
          disabled={busy || !m.active}
          onChange={(e) => onChange({ role: e.target.value as ClinicRole })}
          className="h-9 rounded-lg border border-hairline bg-surface px-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <Button
          variant={m.active ? 'ghost' : 'secondary'}
          size="sm"
          disabled={busy || (self && m.active)}
          title={self ? "You can't deactivate yourself" : undefined}
          onClick={() => {
            if (!m.active || window.confirm(`Deactivate ${m.email}? They lose access at once.`)) onChange({ active: !m.active });
          }}
        >
          {m.active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>
    </li>
  );
}

function Invite({ onDone }: { onDone: () => void }) {
  const invite = useInvite();
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'DOCTOR' as ClinicRole });
  const [sent, setSent] = useState<string>();
  const problems = invite.error instanceof ApiError ? invite.error.problems : [];

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    invite.mutate(
      { email: form.email.trim(), role: form.role, firstName: form.firstName.trim() || undefined, lastName: form.lastName.trim() || undefined },
      {
        onSuccess: (m) => {
          setSent(m.email);
          setForm({ email: '', firstName: '', lastName: '', role: form.role });
        },
      },
    );
  };

  return (
    <Card title="Invite a member" className="mb-6">
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" required error={problems.includes('email') ? 'Enter a valid email address' : undefined}>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
        </Field>
        <div className="space-y-1.5">
          <span className="block text-[13px] font-medium text-ink-soft">Role</span>
          <Segmented value={form.role} onChange={(role) => setForm({ ...form, role })} options={ROLES} />
        </div>
        <Field label="First name">
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </Field>
        <Field label="Last name">
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </Field>
        {sent ? (
          <p className="inline-flex items-center gap-2 rounded-lg bg-healing-soft px-3 py-2 text-[13px] text-healing sm:col-span-2">
            <Mail size={15} /> {sent} was added. New accounts get an email to set a password.
          </p>
        ) : null}
        {invite.error && !problems.length ? <p className="text-[13px] text-overdue sm:col-span-2">{errorMessage(invite.error)}</p> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? 'Inviting…' : 'Send invite'}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Close
          </Button>
        </div>
      </form>
    </Card>
  );
}
