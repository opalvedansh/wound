'use client';

import type { WoundStatus } from '@antigravity-project-spec-pack/domain/api';
import { AlertCircle, CheckCircle2, Eye, RotateCw, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
  secondary: 'bg-surface text-ink border border-hairline hover:bg-surface-alt',
  ghost: 'text-ink-soft hover:bg-surface-alt',
  danger: 'bg-overdue-soft text-overdue hover:brightness-95',
};
const SIZE = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2' } as const;
const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none cursor-pointer whitespace-nowrap';

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: keyof typeof SIZE; icon?: LucideIcon };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: I, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} {...rest} className={cx(BASE, VARIANT[variant], SIZE[size], className)}>
      {I ? <I size={size === 'sm' ? 15 : 16} strokeWidth={2} /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  icon: I,
  children,
  className,
  onMouseEnter,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof SIZE;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  onMouseEnter?: () => void;
}) {
  return (
    <Link href={href} onMouseEnter={onMouseEnter} className={cx(BASE, VARIANT[variant], SIZE[size], className)}>
      {I ? <I size={size === 'sm' ? 15 : 16} /> : null}
      {children}
    </Link>
  );
}

// ---------- Surfaces ----------

export function Card({
  children,
  className,
  title,
  action,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cx('print-break-avoid rounded-2xl border border-hairline bg-surface', className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="no-print mb-2 inline-block text-[13px] font-medium text-accent hover:underline">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: I,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'review' | 'overdue';
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span
          className={cx(
            'grid size-8 place-items-center rounded-lg',
            tone === 'review' ? 'bg-review-soft text-review' : tone === 'overdue' ? 'bg-overdue-soft text-overdue' : 'bg-accent-soft text-accent',
          )}
        >
          <I size={16} />
        </span>
      </div>
      <div className="mt-3 text-[32px] leading-none font-semibold tracking-tight tabular">{value}</div>
      {hint ? <div className="mt-2 text-[13px] text-muted">{hint}</div> : null}
    </>
  );
  const cls = 'block rounded-2xl border border-hairline bg-surface p-5';
  return href ? (
    <Link href={href} className={cx(cls, 'transition-colors hover:border-accent/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---------- Status ----------

export const STATUS_LABEL: Record<WoundStatus, string> = { healing: 'Healing', review: 'Needs review', overdue: 'Overdue' };
const STATUS_STYLE: Record<WoundStatus, { cls: string; Icon: LucideIcon }> = {
  healing: { cls: 'bg-healing-soft text-healing', Icon: CheckCircle2 },
  review: { cls: 'bg-review-soft text-review', Icon: Eye },
  overdue: { cls: 'bg-overdue-soft text-overdue', Icon: AlertCircle },
};

/** Status is never colour alone: icon + label always. */
export function StatusBadge({ status }: { status: WoundStatus | null }) {
  if (!status) return <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-muted">No visits</span>;
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap', cls)}>
      <Icon size={13} strokeWidth={2.25} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------- Forms ----------

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-ink-soft">
        {label}
        {required ? <span className="text-overdue"> *</span> : null}
      </span>
      {children}
      {error ? <span className="block text-[13px] text-overdue">{error}</span> : hint ? <span className="block text-[13px] text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  'h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-faint outline-none transition-colors focus:border-accent focus:ring-3 focus:ring-accent/15';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} {...rest} className={cx(inputCls, className)} />;
});

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cx('inline-flex rounded-lg bg-surface-alt p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-8 cursor-pointer rounded-md px-3 text-[13px] font-medium transition-colors',
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-[13px] text-muted">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-accent' : 'bg-hairline',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0 size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onClick}
      className={cx(
        'h-8 cursor-pointer rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
        selected ? 'border-accent bg-accent text-on-accent' : 'border-hairline bg-surface text-ink-soft hover:border-faint',
      )}
    >
      {children}
    </button>
  );
}

// ---------- Feedback ----------

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

export function EmptyState({ icon: I, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-alt text-muted">
        <I size={22} />
      </span>
      <p className="mt-1 text-[15px] font-semibold">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** A failed load, with a retry that refetches only what failed. */
export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-overdue-soft px-4 py-3 text-sm text-overdue">
      <AlertCircle size={18} className="shrink-0" />
      <span className="flex-1">{error instanceof Error ? error.message : 'Something went wrong.'}</span>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-hairline">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-6 py-2.5 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- Skeletons (the page's shape while its data loads) ----------

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-lg bg-surface-alt', className)} />;
}

export function PageSkeleton({ tiles = 0, rows = 6 }: { tiles?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      {tiles ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
        </div>
      ) : null}
      <div className="space-y-px overflow-hidden rounded-2xl border border-hairline bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
