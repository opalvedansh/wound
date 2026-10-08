'use client';

import type { ClinicRole } from '@antigravity-project-spec-pack/domain/api';
import { useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Download,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ShieldCheck,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { activeClinicId, setActiveClinicId } from '../lib/api';
import { forgetMe, useMe, useQueueCounts } from '../lib/queries';
import { supabaseBrowser } from '../lib/supabase/client';
import { Avatar, cx, EmptyState, ErrorNote, PageSkeleton, Skeleton } from './ui';

export function Logo() {
  return (
    <span className="grid size-9 place-items-center rounded-[11px] bg-accent text-on-accent">
      <svg width="20" height="20" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.55" />
        <path d="M13 21c0-5 4-9 8-8.5 4.5.5 7 3.5 6.5 7.5-.5 4.5-4 7.5-8 7-4-.4-6.5-2.6-6.5-6z" fill="currentColor" />
        <path d="M20 1v5M34 20h5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: ClinicRole[];
  badge?: boolean;
  platformAdmin?: boolean;
}

const CLINICAL: ClinicRole[] = ['ADMIN', 'DOCTOR'];
const EVERYONE: ClinicRole[] = ['ADMIN', 'DOCTOR', 'FRONT_DESK'];
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: CLINICAL },
  { href: '/patients', label: 'Patients', icon: Users, roles: EVERYONE },
  { href: '/review-queue', label: 'Review queue', icon: ClipboardCheck, roles: CLINICAL, badge: true },
  { href: '/registration', label: 'Register patient', icon: UserPlus, roles: EVERYONE },
  { href: '/export', label: 'Data export', icon: Download, roles: ['ADMIN'] },
  { href: '/settings/members', label: 'Users & roles', icon: ShieldCheck, roles: ['ADMIN'] },
  { href: '/audit', label: 'Audit log', icon: History, roles: ['ADMIN'] },
  { href: '/questions', label: 'Questions', icon: ListChecks, roles: EVERYONE, platformAdmin: true },
];

/** Routes each role may open; anything else sends them to their first page. */
const allowed = (path: string, role: ClinicRole, platformAdmin: boolean) => {
  if (path.startsWith('/cases')) return CLINICAL.includes(role);
  const item = NAV.find((n) => path === n.href || path.startsWith(n.href + '/'));
  if (!item) return true;
  return item.platformAdmin ? platformAdmin : item.roles.includes(role);
};

const ROLE_LABEL: Record<ClinicRole, string> = { ADMIN: 'Admin', DOCTOR: 'Doctor', FRONT_DESK: 'Front desk' };

function NavLink({ item, badge, onNavigate }: { item: NavItem; badge?: number; onNavigate: () => void }) {
  const path = usePathname();
  const active = path === item.href || path.startsWith(item.href + '/');
  const I = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        active ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-surface-alt hover:text-ink',
      )}
    >
      <I size={18} strokeWidth={active ? 2.25 : 2} />
      <span className="flex-1">{item.label}</span>
      {badge ? (
        <span className="rounded-full bg-overdue-soft px-2 py-0.5 text-[11px] font-semibold text-overdue tabular">{badge > 99 ? '99+' : badge}</span>
      ) : null}
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const memberships = me.data?.memberships ?? [];
  const membership = memberships.find((m) => m.clinicId === activeClinicId()) ?? memberships[0];
  const role = membership?.role;
  const clinical = !!role && CLINICAL.includes(role);
  const counts = useQueueCounts(clinical);
  const badge = (counts.data?.drafts ?? 0) + (counts.data?.attention ?? 0);

  // Keep the stored clinic valid (first membership by default), and keep each role on its own pages.
  useEffect(() => {
    if (membership && membership.clinicId !== activeClinicId()) setActiveClinicId(membership.clinicId);
  }, [membership]);
  useEffect(() => {
    if (role && !allowed(path, role, !!me.data?.platformAdmin)) router.replace(clinical ? '/dashboard' : '/patients');
  }, [role, path, clinical, me.data?.platformAdmin, router]);

  const signOut = async () => {
    await supabaseBrowser.auth.signOut();
    forgetMe();
    qc.clear();
    router.replace('/login');
  };

  const switchClinic = (id: string) => {
    setActiveClinicId(id);
    qc.removeQueries({ queryKey: ['clinic'] });
    window.location.assign('/');
  };

  const name = me.data ? `${me.data.firstName} ${me.data.lastName}`.trim() || me.data.email || 'Signed in' : '';
  const items = NAV.filter((n) => (n.platformAdmin ? me.data?.platformAdmin : role && n.roles.includes(role)));

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-3 px-1">
        <Logo />
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Wound Care</div>
          <div className="truncate text-[12px] text-muted">{membership?.clinicName ?? 'Clinic portal'}</div>
        </div>
      </div>
      {me.isPending
        ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="mb-1 h-10" />)
        : items.map((item) => <NavLink key={item.href} item={item} badge={item.badge ? badge : undefined} onNavigate={close} />)}
      <div className="mt-auto space-y-3">
        {memberships.length > 1 ? (
          <label className="block space-y-1 px-1">
            <span className="text-[12px] text-muted">Clinic</span>
            <select
              value={membership?.clinicId}
              onChange={(e) => switchClinic(e.target.value)}
              className="h-9 w-full rounded-lg border border-hairline bg-surface px-2 text-sm"
            >
              {memberships.map((m) => (
                <option key={m.clinicId} value={m.clinicId}>
                  {m.clinicName} · {ROLE_LABEL[m.role]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-3 rounded-xl px-1 py-2">
          {me.data ? <Avatar name={name} size={34} /> : <Skeleton className="size-[34px] rounded-full" />}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-[12px] text-muted">{role ? ROLE_LABEL[role] : me.data?.email}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-alt hover:text-ink"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );

  let content: ReactNode = children;
  if (role && !allowed(path, role, !!me.data?.platformAdmin)) content = <PageSkeleton />;
  else if (me.isError) content = <ErrorNote error={me.error} onRetry={() => void me.refetch()} />;
  else if (me.data && !membership && !path.startsWith('/questions'))
    content = (
      <EmptyState
        icon={Users}
        title="You're not in a clinic yet"
        body="Ask your clinic's admin to invite this email address. You'll get access as soon as they do."
      />
    );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh border-r border-hairline bg-surface lg:block">{nav}</aside>

      {/* Phone / tablet header + drawer */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-surface/90 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold">Wound Care</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="relative grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-surface-alt"
        >
          <Menu size={20} />
          {badge ? <span className="absolute top-2 right-2 size-2 rounded-full bg-overdue" /> : null}
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-surface shadow-xl">
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="absolute top-4 right-3 grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-surface-alt"
            >
              <X size={18} />
            </button>
            {nav}
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        {/* Stays until the clinical validation and regulatory steps in wound-ai/docs/roadmap.md are done. */}
        <p className="no-print border-b border-review/20 bg-review-soft px-4 py-2 text-center text-[12px] font-medium text-review">
          Research prototype, not for patient care. AI results are drafts for a clinician to review.
        </p>
        <main className="print-full mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{content}</main>
      </div>
    </div>
  );
}

