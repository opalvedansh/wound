import type { Case, Patient, Treatment } from './domain';
import { CASE_STATUS_LABEL, type CaseStatusResult } from './status';

/**
 * One wound's visits as a standalone HTML page. The mobile app prints it to PDF; the web portal can print the
 * same page, so a report reads the same wherever it is made.
 */
export interface CaseReportOptions {
  patient: Pick<Patient, 'firstName' | 'lastName' | 'patientId'>;
  /** Worked out by the caller, because dates of birth are free text. */
  age: number | null;
  woundCase: Pick<Case, 'woundLocation' | 'onsetDate'>;
  /** The treatments to include. */
  treatments: Treatment[];
  /** Leaves out the name and age; the patient ID stays so the clinic can match the report to its records. */
  hidePersonal: boolean;
  /** Where a treatment's pre or post photo can be loaded from; leave out for a report without photos. */
  photoSrc?: (treatment: Treatment, phase: 'pre' | 'post') => string | undefined;
  status?: CaseStatusResult;
  generatedAt?: Date;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Spelled out rather than locale-formatted, so "03/04" is never read as the wrong day and month.
const dateText = (value: string | Date | undefined) => {
  if (!value) return '—';
  const day = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);

const cell = (value: string | number | undefined) => (value === undefined || value === '' ? '—' : esc(String(value)));
const list = (values: string[] | undefined) => cell(values?.filter(Boolean).join(', '));

export const caseReportHtml = (o: CaseReportOptions): string => {
  const treatments = [...o.treatments].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const name = `${o.patient.firstName} ${o.patient.lastName}`.trim();
  const who = o.hidePersonal
    ? `Patient ${esc(o.patient.patientId)}`
    : `${esc(name)} <span class="muted">· ID ${esc(o.patient.patientId)}${o.age !== null ? ` · ${o.age} y` : ''}</span>`;
  const woundType = [...treatments].reverse().find((t) => t.assessment?.woundType)?.assessment?.woundType;
  const status = o.status
    ? ` · <strong>${CASE_STATUS_LABEL[o.status.status]}</strong>${o.status.reason ? ` (${esc(o.status.reason)})` : ''}`
    : '';

  const rows = treatments
    .map((t) => {
      const a = t.assessment;
      return `<tr><td>T${t.sequenceNumber}</td><td>${dateText(t.createdAt)}</td><td>${list(t.therapy?.therapyGiven)}</td><td>${cell(t.therapy?.dressingType)}</td><td>${cell(a?.exudateLevel)}</td><td class="n">${cell(a?.pain)}</td><td>${cell(a?.woundAppearanceTrend)}</td><td>${cell(t.therapy?.nextVisitDate)}</td></tr>`;
    })
    .join('');

  const figures = o.photoSrc
    ? treatments.flatMap((t) =>
        (['pre', 'post'] as const).flatMap((phase) => {
          const src = o.photoSrc?.(t, phase);
          return src
            ? [`<figure><img src="${esc(src)}" alt="T${t.sequenceNumber} ${phase}-treatment"/><figcaption>T${t.sequenceNumber} · ${phase === 'pre' ? 'Pre' : 'Post'}-treatment</figcaption></figure>`]
            : [];
        }),
      )
    : [];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Wound care report</title><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111827;margin:40px auto;max-width:900px;padding:0 16px}
    .brand{color:#005B4F;font-size:11px;letter-spacing:.8px;text-transform:uppercase;font-weight:700}
    h1{font-size:24px;margin:6px 0 2px} h2{font-size:17px;margin:28px 0 2px}
    .muted{color:#6B7280;font-size:12px;font-weight:400} table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
    th{text-align:left;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;padding:8px 6px}
    td{border-bottom:1px solid #F1F3F5;padding:8px 6px;vertical-align:top} .n{text-align:right;font-variant-numeric:tabular-nums}
    .photos{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
    figure{margin:0;width:150px;break-inside:avoid} figure img{width:150px;height:200px;object-fit:cover;border-radius:6px;background:#F1F3F5}
    figcaption{font-size:11px;color:#6B7280;margin-top:4px}
    footer{margin-top:40px;color:#9CA3AF;font-size:10px}
    @media print{body{margin:24px}}
  </style></head><body>
    <div class="brand">Wound care report</div>
    <h1>${who}</h1>
    <p class="muted">Generated ${dateText(o.generatedAt ?? new Date())}${o.hidePersonal ? ' · personal details hidden' : ''}</p>
    <section>
      <h2>${esc(o.woundCase.woundLocation || 'Location not recorded')}</h2>
      <p class="muted">${woundType ? `${esc(woundType)} · ` : ''}onset ${dateText(o.woundCase.onsetDate)}${status}</p>
      <table><thead><tr><th>Visit</th><th>Date</th><th>Therapy</th><th>Dressing</th><th>Exudate</th><th class="n">Pain</th><th>Trend</th><th>Next visit</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8" class="muted">No treatments selected</td></tr>'}</tbody></table>
      ${figures.length ? `<div class="photos">${figures.join('')}</div>` : ''}
    </section>
    <footer>Confidential health information. Share only with people involved in the patient's care.</footer>
  </body></html>`;
};
