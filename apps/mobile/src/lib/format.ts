import type { Case, CaseStatus, RevisitAssessment } from '@antigravity-project-spec-pack/domain';
import { colors } from './theme';

export type Trend = NonNullable<RevisitAssessment['woundAppearanceTrend']>;

/** Treatment phases are always named in full, so pre and post can't be confused. */
export const PHASE_NAME = {
  pre: 'Pre-treatment',
  post: 'Post-treatment',
} as const;

export const CASE_STATUS: Record<Case['status'], string> = {
  IN_TREATMENT: 'In treatment',
  EVALUATION: 'Evaluation',
  COMPLETED: 'Completed',
};

export const TREND_COLOR: Record<Trend, string> = {
  Improving: colors.accent,
  Static: colors.textMuted,
  Deteriorating: colors.error,
};

// Each passes 4.5:1 on white, so the status word stays readable at text size.
export const STATUS_COLOR: Record<CaseStatus, string> = {
  healing: colors.accent,
  review: colors.pending,
  overdue: colors.error,
};

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const dayDiff = (from: Date, to: Date) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
export const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const fullDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
/** First letter capitalised for display ("right leg" reads "Right leg"); the stored text is unchanged. */
export const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Question titles are configured data and often arrive in capitals ("WOUND TYPE"). Show them in sentence
 * case, keeping short all-caps words as acronyms (DFU, ABI) and leaving mixed-case words alone.
 */
export const questionTitle = (title: string) =>
  title
    .split(' ')
    .map((word, i) => {
      const letters = word.replace(/[^A-Za-z]/g, '');
      const allCaps = letters === letters.toUpperCase();
      const titleCase = letters.length > 1 && letters.slice(1) === letters.slice(1).toLowerCase();
      const next = (allCaps && letters.length > 3) || (!allCaps && titleCase) ? word.toLowerCase() : word;
      return i === 0 ? sentenceCase(next) : next;
    })
    .join(' ');

/** The year only appears when it isn't the current one. */
export const calendarDate = (d: Date, now: Date) => (d.getFullYear() === now.getFullYear() ? shortDate(d) : fullDate(d));
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A YYYY-MM-DD calendar date as a local date (not UTC midnight), or null if it isn't a real date. */
export const parseDay = (value?: string): Date | null => {
  const parts = value?.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!parts) return null;
  const [y, m, d] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
};

/** Calendar dates go through parseDay; anything else (such as ISO timestamps) through Date. */
export const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const day = parseDay(value);
  if (day) return day;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** A local date as the YYYY-MM-DD string the store and the web portal keep. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface DateParts {
  day: string;
  month: string;
  year: string;
}

export const EMPTY_DATE: DateParts = { day: '', month: '', year: '' };

/** Reads Day / Month / Year boxes into a local date, or says why it can't (nothing entered, or not a real date). */
export const readDateParts = ({ day, month, year }: DateParts): { date?: Date; problem?: 'empty' | 'invalid' } => {
  if (!day && !month && !year) return { problem: 'empty' };
  const [d, m, y] = [Number(day), Number(month), Number(year)];
  const date = new Date(y, m - 1, d);
  const isReal =
    year.length === 4 && y >= 1900 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return isReal ? { date } : { problem: 'invalid' };
};

/** How long ago a past date was, in the unit a clinician would use: days, then weeks, months, years. */
export const timeAgo = (d: Date, now: Date) => {
  const days = dayDiff(d, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months =
    (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0);
  return months < 24 ? `${plural(months, 'month')} ago` : `${plural(Math.floor(months / 12), 'year')} ago`;
};

/** Age in years, or null when the free-text DOB can't be parsed or day/month order would change the answer. */
export const ageFrom = (dob: string, now: Date): number | null => {
  const s = dob.trim();
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const local = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const candidates: [number, number, number][] = iso
    ? [[+iso[1], +iso[2], +iso[3]]]
    : local
      ? [[+local[3], +local[2], +local[1]], [+local[3], +local[1], +local[2]]]
      : [];
  const month = now.getMonth() + 1;
  const ages = candidates
    .filter(([, m, d]) => m >= 1 && m <= 12 && d >= 1 && d <= 31)
    .map(([y, m, d]) => now.getFullYear() - y - (month < m || (month === m && now.getDate() < d) ? 1 : 0));
  if (!ages.length || ages.some((a) => a !== ages[0]) || ages[0] < 0 || ages[0] > 130) return null;
  return ages[0];
};

/** Short form for dense rows: M, F or Other. Free text from older records passes through. */
export const sexLabel = (sex: string) => {
  const s = sex.trim();
  if (/^m(ale)?$/i.test(s)) return 'M';
  if (/^f(emale)?$/i.test(s)) return 'F';
  if (/^o(ther)?$/i.test(s)) return 'Other';
  return s;
};

export const sexName = (sex: string) => {
  const s = sex.trim();
  if (/^m(ale)?$/i.test(s)) return 'Male';
  if (/^f(emale)?$/i.test(s)) return 'Female';
  if (/^o(ther)?$/i.test(s)) return 'Other';
  return s;
};

/** The next planned visit if there is one, otherwise when the patient or wound was last seen. */
export const visitLabel = (next: Date | null, last: Date | null, now: Date) => {
  if (next && dayDiff(now, next) >= 0) {
    const days = dayDiff(now, next);
    return days === 0 ? 'Visit today' : days === 1 ? 'Visit tomorrow' : `Next ${shortDate(next)}`;
  }
  if (last) {
    const days = dayDiff(last, now);
    return days === 0 ? 'Seen today' : days === 1 ? 'Seen yesterday' : `Seen ${shortDate(last)}`;
  }
  return null;
};
