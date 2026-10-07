import { useId, type ReactNode } from "react";

/** The input style shared by forms (same as the Questions editor). */
export const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-black/[0.03] disabled:text-muted-foreground dark:border-white/10 dark:bg-black/20";

/** A labelled form field. `children` receives the id to put on the input so the label points at it. */
export function Field({
  label,
  hint,
  problem,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  problem?: string;
  required?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required && <span className="text-muted-foreground font-normal"> (required)</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground -mt-0.5">{hint}</p>}
      {children(id)}
      {problem && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

/** A page-level loading, error or empty message. */
export function PageNote({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-2xl border px-5 py-8 text-center text-sm ${
        tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-black/5 text-muted-foreground dark:border-white/10"
      }`}
    >
      {children}
    </div>
  );
}
