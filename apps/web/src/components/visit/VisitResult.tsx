"use client"
import { useState, type ReactNode } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, PencilLine, XCircle } from "lucide-react";
import {
  isUncertain,
  woundTypeName,
  type ClassResult,
  type Outline,
  type ReviewDecision,
  type ReviewView,
  type VisitView,
} from "@antigravity-project-spec-pack/domain/wound-model";
import { api, errorMessage } from "../../lib/api";
import { dateTimeText } from "../../lib/format";
import { Button } from "../ui/button";
import { fieldClass } from "../ui/field";

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** The photo with the wound outline drawn over it. Points are 0–1, so the polygons fit any display size. */
export function WoundOverlay({ src, outline }: { src: string; outline?: Outline | null }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black/5">
      <img src={src} alt="Wound photo with the outline found by the model" className="block w-full" />
      {outline && outline.length > 0 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {outline.map((polygon, i) => (
            <polygon
              key={i}
              points={polygon.map(([x, y]) => `${x * 100},${y * 100}`).join(" ")}
              fill="rgba(57, 255, 20, 0.12)"
              stroke="#39ff14"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

/** A classification as the report writes it: a confident label, or UNCERTAIN with the top estimates. */
function classText(result: ClassResult | undefined, name: (label: string) => string): string {
  if (!result) return "Not assessed yet (model not installed)";
  if (isUncertain(result)) {
    return `Uncertain — top estimates: ${result.top.map(([label, p]) => `${name(label)} ${pct(p)}`).join(", ")}`;
  }
  return `${name(result.label)} (model confidence ${pct(result.prob)})`;
}

/** The draft's markdown (headings, bullets, **bold**, _italics_) as plain elements; never injected as HTML. */
function ReportText({ markdown }: { markdown: string }) {
  const inline = (text: string): ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {markdown.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith("## ")) return <h5 key={i} className="pt-2 font-semibold">{line.slice(3)}</h5>;
        if (line.startsWith("# ")) return <h4 key={i} className="text-base font-semibold">{line.slice(2)}</h4>;
        if (line.startsWith("- ")) return <p key={i} className="pl-4 -indent-3">• {inline(line.slice(2))}</p>;
        if (/^_.*_$/.test(line)) return <p key={i} className="italic text-muted-foreground">{line.slice(1, -1)}</p>;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

const DECISION: Record<ReviewDecision, { label: string; icon: typeof CheckCircle2; tone: string }> = {
  approved: { label: "Approved", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  edited: { label: "Edited and approved", icon: PencilLine, tone: "text-sky-800 bg-sky-50 border-sky-200" },
  rejected: { label: "Rejected", icon: XCircle, tone: "text-red-700 bg-red-50 border-red-200" },
};

export function ReviewBadge({ review }: { review: ReviewView | null }) {
  if (!review) {
    return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">Awaiting review</span>;
  }
  const { label, icon: Icon, tone } = DECISION[review.decision];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  );
}

/** Approve, edit or reject the draft. One decision per result; it is stored with the reviewer and time. */
function ReviewPanel({ visit, onReviewed }: { visit: VisitView; onReviewed: (review: ReviewView) => void }) {
  const [mode, setMode] = useState<"choose" | "edit" | "reject">("choose");
  const [text, setText] = useState(visit.draftReport ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  const submit = async (decision: ReviewDecision) => {
    if (decision === "edited" && !text.trim()) return setProblem("Write the corrected report.");
    if (decision === "rejected" && !reason.trim()) return setProblem("Say why the draft is rejected.");
    setBusy(true);
    setProblem(undefined);
    try {
      const review = await api<ReviewView>(`/visits/${visit.aiResultId}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, finalReport: decision === "edited" ? text : undefined, reason: decision === "rejected" ? reason : undefined }),
      });
      onReviewed(review);
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
      <p className="text-sm font-semibold">Clinician review</p>
      <p className="text-xs text-muted-foreground mt-0.5">Nothing in this draft is part of the record until you approve or edit it.</p>
      {mode === "edit" && (
        <textarea aria-label="Corrected report" className={`${fieldClass} mt-3 min-h-64 font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} />
      )}
      {mode === "reject" && (
        <textarea
          aria-label="Reason for rejecting"
          placeholder="For example: wrong wound outlined, photo of the wrong site"
          className={`${fieldClass} mt-3 min-h-24`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      )}
      {problem && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "choose" ? (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit("approved")}>
              {busy ? "Saving…" : "Approve draft"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode("edit")}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode("reject")}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit(mode === "edit" ? "edited" : "rejected")}>
              {busy ? "Saving…" : mode === "edit" ? "Save and approve" : "Reject draft"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => (setMode("choose"), setProblem(undefined))}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** One analysed photo: flags first, the outlined photo, the findings, the draft, and the review. */
export function VisitResult({ visit, onReviewed }: { visit: VisitView; onReviewed: (review: ReviewView) => void }) {
  const f = visit.findings;
  const m = f.measurement;
  const change = f.change?.percent_area_reduction;
  const flags = [...(f.flags ?? [])].sort((a, b) => (a.level === b.level ? 0 : a.level === "urgent" ? -1 : 1));

  const findings: [string, string][] = [
    ["Wound type", classText(f.wound_type, woundTypeName)],
    ...Object.entries(f.severity ?? {}).map(([head, result]): [string, string] => [
      head.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      classText(result, (label) => label.replace(/_/g, " ")),
    ]),
    [
      "Size",
      m
        ? `${m.area_cm2} cm² · ${m.length_cm} × ${m.width_cm} cm · perimeter ${m.perimeter_cm} cm`
        : f.marker_found === false
          ? "Not measured: calibration sticker not found in the photo"
          : "Not measured: no wound outline yet (outline model not installed)",
    ],
    ...(change !== undefined
      ? [[
          "Change",
          `${change >= 0 ? "Smaller" : "Larger"} by ${Math.abs(change)}% since the last measured photo${f.change?.days_between ? ` (${f.change.days_between} days)` : ""}`,
        ] as [string, string]]
      : []),
    ...(f.tissue_pct ? [["Tissue", Object.entries(f.tissue_pct).map(([k, v]) => `${k} ${v}%`).join(", ")] as [string, string]] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">
        AI draft for clinician review, not a diagnosis.
      </p>

      {flags.length > 0 && (
        <ul className="flex flex-col gap-2">
          {flags.map((flag) => {
            const urgent = flag.level === "urgent";
            const Icon = urgent ? AlertOctagon : AlertTriangle;
            return (
              <li
                key={flag.text}
                className={`flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${
                  urgent ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">{urgent ? "Urgent: " : "Review: "}</strong>
                  {flag.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {visit.photoUrl ? (
          <WoundOverlay src={visit.photoUrl} outline={f.outline} />
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-2xl bg-black/5 text-sm text-muted-foreground">Photo unavailable</div>
        )}
        <dl className="flex flex-col gap-3 text-sm">
          {findings.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-0.5">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Analysed</dt>
            <dd className="mt-0.5">{dateTimeText(visit.takenAt)}</dd>
          </div>
        </dl>
      </div>

      {visit.review ? (
        <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <ReviewBadge review={visit.review} />
            <span className="text-xs text-muted-foreground">{dateTimeText(visit.review.createdAt)}</span>
          </div>
          {visit.review.reason && <p className="mt-2 text-sm">Reason: {visit.review.reason}</p>}
          {visit.review.finalReport && (
            <div className="mt-3">
              <ReportText markdown={visit.review.finalReport} />
            </div>
          )}
        </div>
      ) : (
        <>
          {visit.draftReport && (
            <details className="rounded-2xl border border-black/10 p-4 dark:border-white/10" open>
              <summary className="cursor-pointer text-sm font-semibold">Draft report</summary>
              <div className="mt-3">
                <ReportText markdown={visit.draftReport} />
              </div>
            </details>
          )}
          <ReviewPanel visit={visit} onReviewed={onReviewed} />
        </>
      )}
    </div>
  );
}

/** Area over time, once at least two visits have a measured size. */
export function AreaTrend({ visits }: { visits: VisitView[] }) {
  const points = visits
    .filter((v) => v.findings.measurement)
    .map((v) => ({ at: new Date(v.takenAt).getTime(), area: v.findings.measurement!.area_cm2 }))
    .sort((a, b) => a.at - b.at);
  if (points.length < 2) return null;

  const [w, h, pad] = [320, 120, 16];
  const t0 = points[0].at;
  const span = Math.max(1, points[points.length - 1].at - t0);
  const max = Math.max(...points.map((p) => p.area));
  const xy = points.map((p) => [pad + ((p.at - t0) / span) * (w - 2 * pad), h - pad - (p.area / max) * (h - 2 * pad)]);
  const first = points[0].area;
  const last = points[points.length - 1].area;

  return (
    <figure className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
      <figcaption className="text-sm font-semibold">
        Wound area: {first} → {last} cm²
        <span className="ml-2 font-normal text-muted-foreground">
          ({last <= first ? "down" : "up"} {Math.abs(Math.round(((last - first) / first) * 100))}% over {points.length} measured visits)
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full max-w-md" role="img" aria-label={`Wound area from ${first} to ${last} square centimetres`}>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity={0.15} />
        <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill="hsl(var(--primary))" />
        ))}
      </svg>
    </figure>
  );
}
