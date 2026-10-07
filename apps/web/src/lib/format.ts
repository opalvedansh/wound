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
