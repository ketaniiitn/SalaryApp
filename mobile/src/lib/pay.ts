const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const longDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(iso: string): { year: number; month: number; day: number; weekday: number } {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(year, (month || 1) - 1, day || 1).getDay();
  return { year, month, day, weekday };
}

/** Whole rupees with Indian grouping: ₹1,00,000. No minus sign; callers decide how to word a negative. */
export function formatRupees(amount: number): string {
  const whole = String(Math.round(Math.abs(amount)));
  const tail = whole.slice(-3);
  const head = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${head ? `${head},${tail}` : tail}`;
}

/** "Fri, 20 Nov", with the year added outside the current year. */
export function formatDay(iso: string): string {
  const { year, month, day, weekday } = parts(iso);
  if (!year || !month || !day) return iso;
  const sameYear = String(year) === todayIso().slice(0, 4);
  return `${shortDays[weekday]}, ${day} ${months[month - 1]}${sameYear ? "" : ` ${year}`}`;
}

/** "Saturday, 14 Nov" */
export function formatLongDay(iso: string): string {
  const { month, day, weekday } = parts(iso);
  return `${longDays[weekday]}, ${day} ${months[month - 1]}`;
}

/** "20 Nov" */
export function formatShortDate(iso: string): string {
  const { month, day } = parts(iso);
  return `${day} ${months[month - 1]}`;
}

export function weekdayName(iso: string): string {
  return longDays[parts(iso).weekday];
}

/** "November" for "2026-11" or "2026-11-20". */
export function monthName(isoOrMonth: string): string {
  const month = Number(isoOrMonth.slice(5, 7));
  return longMonths[month - 1] ?? isoOrMonth;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function monthLastDay(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(year, mon, 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function shiftMonth(month: string, by: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(year, mon - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export type SalaryBasis = "month" | "day";

export function amountPayable(input: {
  salary: number;
  salaryBasis: SalaryBasis;
  workingDays: number;
  daysWorked: number;
}): number {
  const raw =
    input.salaryBasis === "day"
      ? input.salary * input.daysWorked
      : (input.salary / input.workingDays) * input.daysWorked;
  return Math.round(raw * 100) / 100;
}
