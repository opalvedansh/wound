import type { Case, Treatment } from './domain';

/**
 * One status rule for the mobile app and the web portal, so a case reads the same everywhere.
 * Overdue: the latest visit's next-visit date has passed. Needs review: the latest assessment marks the
 * wound as deteriorating. Otherwise Healing. (Low AI confidence joins "Needs review" once AI results exist.)
 */
export type CaseStatus = 'healing' | 'review' | 'overdue';

export interface CaseStatusResult {
  status: CaseStatus;
  /** Why the case needs attention; absent for Healing. */
  reason?: string;
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  healing: 'Healing',
  review: 'Needs review',
  overdue: 'Overdue',
};

const SEVERITY: Record<CaseStatus, number> = { healing: 0, review: 1, overdue: 2 };
const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/**
 * When the patient is due back, from the care form's next-visit answer: an interval ("1 Week", "In 3 Days")
 * counted from that visit, or a YYYY-MM-DD date. "PRN (As Needed)" and other text have no due date.
 */
export const nextVisitDue = (treatment: Pick<Treatment, 'therapy' | 'createdAt'>): Date | null => {
  const text = treatment.therapy?.nextVisitDate?.trim();
  if (!text) return null;

  const interval = text.match(/^(?:in\s+)?(\d+)\s*(day|week|month)s?$/i);
  if (interval) {
    const visit = new Date(treatment.createdAt);
    if (Number.isNaN(visit.getTime())) return null;
    const n = Number(interval[1]);
    const unit = interval[2].toLowerCase();
    return new Date(
      visit.getFullYear(),
      visit.getMonth() + (unit === 'month' ? n : 0),
      visit.getDate() + (unit === 'day' ? n : unit === 'week' ? n * 7 : 0),
    );
  }

  const day = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!day) return null;
  const [y, m, d] = [Number(day[1]), Number(day[2]), Number(day[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
};

/** The status of one wound, or undefined while it has no visit yet or once it is closed. */
export const caseStatus = (
  woundCase: Pick<Case, 'status'>,
  treatments: Treatment[],
  now: Date = new Date(),
): CaseStatusResult | undefined => {
  if (woundCase.status === 'COMPLETED' || treatments.length === 0) return undefined;
  const visits = [...treatments].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // Only the latest visit's plan counts: once the patient is seen again, the earlier due date is met.
  const due = nextVisitDue(visits[visits.length - 1]);
  const daysLate = due ? daysBetween(due, now) : 0;
  if (daysLate > 0) {
    return { status: 'overdue', reason: `Visit overdue by ${daysLate} ${daysLate === 1 ? 'day' : 'days'}` };
  }

  const trend = visits.reverse().find((t) => t.assessment?.woundAppearanceTrend)?.assessment?.woundAppearanceTrend;
  if (trend === 'Deteriorating') return { status: 'review', reason: 'Wound marked as deteriorating' };

  return { status: 'healing' };
};

/** A patient takes the most urgent status among their wounds. */
export const worstStatus = (statuses: (CaseStatusResult | undefined)[]): CaseStatusResult | undefined =>
  statuses.reduce<CaseStatusResult | undefined>(
    (worst, s) => (s && (!worst || SEVERITY[s.status] > SEVERITY[worst.status]) ? s : worst),
    undefined,
  );
