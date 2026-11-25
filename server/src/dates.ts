// Every "today" and "this month" is in the organisation's time zone, not the server's clock.
// A server on a UTC host would otherwise still be in yesterday until 05:30 IST, so on the 1st
// "this month" would be last month. Set APP_TIME_ZONE to change it.
const TIME_ZONE = process.env.APP_TIME_ZONE?.trim() || "Asia/Kolkata";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Today as YYYY-MM-DD in the app's time zone. */
export function todayIso(now = new Date()): string {
  const parts = Object.fromEntries(dayFormat.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function currentMonthKey(now = new Date()): string {
  return todayIso(now).slice(0, 7);
}

export function monthEnd(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${key}-${String(last).padStart(2, "0")}`;
}

export function daysInMonth(key: string): number {
  return Number(monthEnd(key).slice(8, 10));
}

/** Tomorrow in the app's time zone: one day of slack for a phone whose clock is slightly ahead. */
export function latestAllowedDate(now = new Date()): string {
  const [year, month, day] = todayIso(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
