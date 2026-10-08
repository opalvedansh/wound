const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "7 Oct 2026". Spelled out so 03/04 is never read with day and month swapped. YYYY-MM-DD is a local calendar day. */
export const dateText = (value: string) => {
  const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const dateTimeText = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${dateText(iso)}, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
};

/** Today as YYYY-MM-DD in local time, for date inputs' `max`. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const SEX_NAME: Record<string, string> = { M: "Male", F: "Female", O: "Other" };

export const shortDate = dateText;

/** Whole days from today to a YYYY-MM-DD day or ISO time (negative = past), in local time. */
export const daysFromToday = (value: string) => {
  const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  const today = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86_400_000);
};

/** "Today", "Tomorrow", "In 3 days", "2 days ago"; further away, the date. */
export const relativeDay = (value: string) => {
  const n = daysFromToday(value);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n <= 14) return `In ${n} days`;
  if (n < -1 && n >= -14) return `${-n} days ago`;
  return dateText(value);
};

/** Age in years from a date of birth, or the recorded age. */
export const ageOf = (p: { dateOfBirth: string | null; ageYears: number | null }) => {
  if (p.dateOfBirth) {
    const [y, m, d] = p.dateOfBirth.split('-').map(Number);
    const now = new Date();
    return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
  }
  return p.ageYears;
};

export const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}%`);
