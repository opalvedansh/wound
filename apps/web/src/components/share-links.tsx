'use client';

import { Check, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../lib/api';
import { shortDate } from '../lib/format';
import { useCreateShareLink, useRevokeShareLink, useShareLinks } from '../lib/queries';
import { Button, Card, Segmented, Skeleton, Toggle, cx, inputCls } from './ui';

const STATE_LABEL = { active: 'Active', expired: 'Expired', revoked: 'Revoked' } as const;

/**
 * Read-only links to this wound's report for a referring doctor or the patient. A link opens without signing
 * in, expires after the chosen days and can be revoked; its address is shown once (only a hash is stored).
 */
export function ShareLinks({ caseId }: { caseId: string }) {
  const links = useShareLinks(caseId);
  const create = useCreateShareLink(caseId);
  const revoke = useRevokeShareLink(caseId);
  const [hide, setHide] = useState(true);
  const [days, setDays] = useState<'1' | '7' | '30'>('7');
  const [created, setCreated] = useState<string>();
  const [copied, setCopied] = useState(false);

  const make = () =>
    create.mutate(
      { hidePersonal: hide, days: Number(days) },
      {
        onSuccess: (link) => {
          setCreated(link.url);
          setCopied(false);
        },
      },
    );

  const error = create.error ?? revoke.error ?? links.error;

  return (
    <Card title="Share links">
      <div className="space-y-4">
        <Toggle
          label="Hide personal details"
          description="Shows the patient ID only, no name. Recommended for anyone outside the clinic."
          checked={hide}
          onChange={setHide}
        />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-muted">Expires after</span>
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { value: '1', label: '1 day' },
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
            ]}
          />
          <Button icon={Link2} onClick={make} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create link'}
          </Button>
        </div>
        {created ? (
          <div className="space-y-2 rounded-xl bg-accent-soft p-3">
            <p className="text-[12px] text-ink-soft">Copy it now: the link is shown only once. Anyone with it can open the report until it expires.</p>
            <div className="flex gap-2">
              <input readOnly value={created} onFocus={(e) => e.currentTarget.select()} className={cx(inputCls, 'h-9 flex-1 text-[12px]')} />
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={() => void navigator.clipboard.writeText(created).then(() => setCopied(true))}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : null}
        {error ? <p className="text-[13px] text-overdue">{errorMessage(error)}</p> : null}
        {links.isPending ? (
          <Skeleton className="h-10" />
        ) : links.data?.length ? (
          <ul className="divide-y divide-hairline text-[13px]">
            {links.data.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="font-medium">
                    {STATE_LABEL[l.state]} · made {shortDate(l.createdAt)}
                  </div>
                  <div className="text-[12px] text-muted">
                    {l.state === 'active' ? `Expires ${shortDate(l.expiresAt)} · ` : ''}
                    {l.hidePersonal ? 'Personal details hidden' : 'Shows personal details'} · opened {l.viewCount}×
                  </div>
                </div>
                {l.state === 'active' ? (
                  <Button variant="danger" size="sm" disabled={revoke.isPending && revoke.variables === l.id} onClick={() => revoke.mutate(l.id)}>
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No links made for this wound yet.</p>
        )}
      </div>
    </Card>
  );
}
