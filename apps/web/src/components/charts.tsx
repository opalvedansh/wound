'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Small SVG charts following the data-viz rules: thin marks (<=24px), 4px rounded
// data-ends square at the baseline, hairline grid, hover tooltips, text in ink
// tokens (never the series colour), legend only for 2+ series.

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

/** Column whose top (data end) is rounded and base is square. */
function colPath(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h, w / 2);
  return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
}

/** Horizontal bar from x0 to x0+w (w may be negative); rounded at the data end. */
function barPath(x0: number, y: number, w: number, h: number, r = 4) {
  const dir = Math.sign(w) || 1;
  const len = Math.abs(w);
  const rr = Math.min(r, len, h / 2);
  const x1 = x0 + w;
  return `M${x0} ${y}H${x1 - dir * rr}Q${x1} ${y} ${x1} ${y + rr}V${y + h - rr}Q${x1} ${y + h} ${x1 - dir * rr} ${y + h}H${x0}Z`;
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[12px] whitespace-nowrap shadow-lg"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

// ---------- Column chart (single series, change over discrete periods) ----------

export function ColumnChart({
  data,
  height = 220,
  unit,
}: {
  data: { label: string; value: number; detail?: string }[];
  height?: number;
  unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 32, r: 8, t: 16, b: 26 };
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, band * 0.55);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`Column chart of ${unit}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--viz-grid)"
                strokeWidth={1}
              />
              <text
                x={pad.l - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted text-[11px] tabular"
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.l + band * i + band / 2;
            const h = Math.max(0, plotH - (y(d.value) - pad.t));
            const last = i === data.length - 1;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect
                  x={pad.l + band * i}
                  y={pad.t}
                  width={band}
                  height={plotH}
                  fill={hover === i ? 'var(--viz-grid)' : 'transparent'}
                  opacity={0.6}
                />
                {d.value > 0 ? (
                  <path d={colPath(cx - barW / 2, y(d.value), barW, h)} fill="var(--viz-1)" />
                ) : null}
                <text x={cx} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
                  {d.label}
                </text>
                {last && d.value > 0 ? (
                  <text
                    x={cx}
                    y={y(d.value) - 6}
                    textAnchor="middle"
                    className="fill-ink text-[11px] font-semibold tabular"
                  >
                    {fmt(d.value)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {hover !== null && data[hover] ? (
        <Tooltip x={pad.l + band * hover + band / 2} y={y(data[hover].value)}>
          <div className="font-semibold">{data[hover].detail ?? data[hover].label}</div>
          <div className="text-muted">
            <span className="tabular font-medium text-ink">{fmt(data[hover].value)}</span> {unit}
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}

// ---------- Horizontal bars (magnitude by category) ----------

export function BarList({
  data,
  unit,
}: {
  data: { label: string; value: number }[];
  unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = Math.min(170, width * 0.42);
  const valueW = 36;
  const max = Math.max(...data.map((d) => d.value), 1);
  const row = 30;
  const barH = 14;
  const plotW = Math.max(0, width - labelW - valueW);
  const height = data.length * row;

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`Bar chart of ${unit}`}>
          {data.map((d, i) => {
            const w = (d.value / max) * plotW;
            const yy = i * row + (row - barH) / 2;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect
                  x={0}
                  y={i * row}
                  width={width}
                  height={row}
                  fill={hover === i ? 'var(--viz-grid)' : 'transparent'}
                  opacity={0.6}
                  rx={6}
                />
                <text x={0} y={i * row + row / 2} dy="0.32em" className="fill-ink-soft text-[12px]">
                  {d.label}
                </text>
                <line
                  x1={labelW}
                  x2={labelW}
                  y1={i * row + 4}
                  y2={i * row + row - 4}
                  stroke="var(--viz-grid)"
                />
                {w > 0 ? <path d={barPath(labelW, yy, w, barH)} fill="var(--viz-1)" /> : null}
                <text
                  x={labelW + w + 6}
                  y={i * row + row / 2}
                  dy="0.32em"
                  className="fill-ink text-[12px] font-semibold tabular"
                >
                  {d.value}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}
      {hover !== null && data[hover] ? (
        <Tooltip x={labelW + (data[hover].value / max) * plotW} y={hover * row + 6}>
          <div className="font-semibold">{data[hover].label}</div>
          <div className="text-muted">
            <span className="tabular font-medium text-ink">{data[hover].value}</span> {unit}
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}

// ---------- Diverging bars (polarity: shrinking vs growing) ----------

export function DivergingBars({
  data,
  onSelect,
}: {
  data: { id: string; label: string; sub: string; value: number }[];
  onSelect?: (id: string) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = Math.min(150, width * 0.36);
  const row = 28;
  const barH = 12;
  const plotW = Math.max(0, width - labelW - 8);
  // Zero sits in proportion to the data range (each arm keeps 40px for its value label).
  const neg = Math.max(...data.map((d) => -d.value), 5);
  const pos = Math.max(...data.map((d) => d.value), 5);
  const unit = Math.max(0, plotW - 80) / (neg + pos);
  const zero = labelW + 40 + neg * unit;
  const sx = (v: number) => v * unit;
  const height = data.length * row;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--viz-1)' }} /> Shrinking
          (good)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--viz-neg)' }} /> Growing
        </span>
      </div>
      <div ref={ref} className="relative">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Area change per case since first visit"
          >
            <line x1={zero} x2={zero} y1={0} y2={height} stroke="var(--faint)" strokeWidth={1} />
            {data.map((d, i) => {
              const w = sx(d.value);
              const yy = i * row + (row - barH) / 2;
              const neg = d.value < 0;
              return (
                <g
                  key={d.id}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect?.(d.id)}
                  className={onSelect ? 'cursor-pointer' : undefined}
                >
                  <rect
                    x={0}
                    y={i * row}
                    width={width}
                    height={row}
                    fill={hover === i ? 'var(--viz-grid)' : 'transparent'}
                    opacity={0.6}
                    rx={6}
                  />
                  <text
                    x={0}
                    y={i * row + row / 2}
                    dy="0.32em"
                    className="fill-ink-soft text-[12px]"
                  >
                    {d.label}
                  </text>
                  {Math.abs(w) > 0.5 ? (
                    <path
                      d={barPath(zero, yy, w, barH)}
                      fill={neg ? 'var(--viz-1)' : 'var(--viz-neg)'}
                    />
                  ) : null}
                  <text
                    x={zero + w + (neg ? -6 : 6)}
                    y={i * row + row / 2}
                    dy="0.32em"
                    textAnchor={neg ? 'end' : 'start'}
                    className="fill-ink text-[11px] font-semibold tabular"
                  >
                    {d.value > 0 ? '+' : d.value < 0 ? '−' : ''}
                    {Math.abs(d.value).toFixed(0)}%
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
        {hover !== null && data[hover] ? (
          <Tooltip x={zero + sx(data[hover].value)} y={hover * row + 4}>
            <div className="font-semibold">{data[hover].label}</div>
            <div className="text-muted">{data[hover].sub}</div>
            <div className="text-muted">
              Area{' '}
              <span className="tabular font-medium text-ink">
                {data[hover].value > 0 ? '+' : ''}
                {data[hover].value.toFixed(0)}%
              </span>{' '}
              since first visit
            </div>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Line chart (change over time, single series) ----------

export function LineChart({
  data,
  height = 200,
  unit,
}: {
  data: { label: string; value: number; detail?: string }[];
  height?: number;
  unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 16, t: 16, b: 26 };
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length < 2 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.value)}`).join(' ');
  const area = data.length
    ? `${line} L${x(data.length - 1)} ${pad.t + plotH} L${x(0)} ${pad.t + plotH} Z`
    : '';
  const ticks = [0, max / 2, max];
  const last = data.length - 1;

  return (
    <div
      ref={ref}
      className="relative"
      style={{ height }}
      onMouseMove={(e) => {
        if (!data.length || plotW <= 0) return;
        const rx = e.clientX - e.currentTarget.getBoundingClientRect().left - pad.l;
        setHover(Math.max(0, Math.min(last, Math.round((rx / plotW) * (data.length - 1)))));
      }}
      onMouseLeave={() => setHover(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`Line chart of ${unit}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" />
              <text
                x={pad.l - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted text-[11px] tabular"
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--viz-1)" opacity={0.1} />
          <path
            d={line}
            fill="none"
            stroke="var(--viz-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {data.map((d, i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted text-[11px]"
            >
              {d.label}
            </text>
          ))}
          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="var(--faint)" />
          ) : null}
          {data.map((d, i) =>
            i === last || i === hover ? (
              <circle
                key={i}
                cx={x(i)}
                cy={y(d.value)}
                r={4.5}
                fill="var(--viz-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ) : null,
          )}
          {last >= 0 && data[last] ? (
            <text
              x={x(last)}
              y={y(data[last].value) - 10}
              textAnchor="end"
              className="fill-ink text-[11px] font-semibold tabular"
            >
              {fmt(data[last].value)} {unit}
            </text>
          ) : null}
        </svg>
      ) : null}
      {hover !== null && data[hover] ? (
        <Tooltip x={x(hover)} y={y(data[hover].value)}>
          <div className="font-semibold">{data[hover].detail ?? data[hover].label}</div>
          <div className="text-muted">
            <span className="tabular font-medium text-ink">{fmt(data[hover].value)}</span> {unit}
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}
