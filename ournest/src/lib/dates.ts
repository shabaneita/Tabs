/**
 * Calendar helpers. Financial dates are civil dates ("YYYY-MM-DD") in
 * Dubai local time. All arithmetic happens on UTC-anchored dates so the
 * result never depends on the device's time zone.
 */
import { TZDate } from "@date-fns/tz";
import { addDays as dfAddDays, addMonths as dfAddMonths, differenceInCalendarDays, differenceInCalendarMonths, getDaysInMonth } from "date-fns";
import type { Numerals } from "./money";

export const DUBAI_TZ = "Asia/Dubai";
export type ISODate = string; // YYYY-MM-DD

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const d = toUTC(value);
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() + 1 === Number(m[2]) && d.getUTCDate() === Number(m[3]);
}

function toUTC(iso: ISODate): TZDate {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), "UTC");
}

function fromUTC(d: Date): ISODate {
  const t = new TZDate(d, "UTC");
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Today's civil date in Dubai. */
export function todayInDubai(now: Date = new Date()): ISODate {
  const t = new TZDate(now, DUBAI_TZ);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Current hour (0-23) in Dubai, for greetings. */
export function hourInDubai(now: Date = new Date()): number {
  return new TZDate(now, DUBAI_TZ).getHours();
}

export const addDays = (iso: ISODate, n: number): ISODate => fromUTC(dfAddDays(toUTC(iso), n));
/** Adds months, clamping to the end of shorter months (31 Jan + 1 → 28/29 Feb). */
export const addMonths = (iso: ISODate, n: number): ISODate => fromUTC(dfAddMonths(toUTC(iso), n));
export const diffDays = (later: ISODate, earlier: ISODate): number => differenceInCalendarDays(toUTC(later), toUTC(earlier));
export const diffMonths = (later: ISODate, earlier: ISODate): number => differenceInCalendarMonths(toUTC(later), toUTC(earlier));
export const monthStart = (iso: ISODate): ISODate => `${iso.slice(0, 7)}-01`;
export const daysInMonth = (iso: ISODate): number => getDaysInMonth(toUTC(iso));
export const monthEnd = (iso: ISODate): ISODate => `${iso.slice(0, 7)}-${String(daysInMonth(iso)).padStart(2, "0")}`;
export const monthKey = (iso: ISODate): string => iso.slice(0, 7);
export const isSameMonth = (a: ISODate, b: ISODate): boolean => a.slice(0, 7) === b.slice(0, 7);
export const dayOfMonth = (iso: ISODate): number => Number(iso.slice(8, 10));
export const compareISO = (a: ISODate, b: ISODate): number => (a < b ? -1 : a > b ? 1 : 0);
export const maxISO = (a: ISODate, b: ISODate): ISODate => (a > b ? a : b);
export const minISO = (a: ISODate, b: ISODate): ISODate => (a < b ? a : b);

/** Fraction (0..1] of the month elapsed by `today`, inclusive of today. */
export function monthElapsedFraction(month: ISODate, today: ISODate): number {
  const start = monthStart(month);
  if (today < start) return 0;
  if (today > monthEnd(month)) return 1;
  return dayOfMonth(today) / daysInMonth(month);
}

/** "2026-10" -> list of last n month starts ending at `month` (oldest first). */
export function lastMonths(month: ISODate, n: number): ISODate[] {
  const start = monthStart(month);
  return Array.from({ length: n }, (_, i) => addMonths(start, i - (n - 1)));
}

// ---------------------------------------------------------------------------
// Arabic formatting
// ---------------------------------------------------------------------------
const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(numerals: Numerals, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = numerals + JSON.stringify(opts);
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(`ar-AE-u-nu-${numerals}`, { timeZone: "UTC", ...opts });
    dtfCache.set(key, f);
  }
  return f;
}

export type DateStyle = "day" | "dayMonth" | "full" | "month" | "monthShort" | "weekday" | "weekdayShort";

const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  day: { day: "numeric" },
  dayMonth: { day: "numeric", month: "long" },
  full: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  month: { month: "long", year: "numeric" },
  monthShort: { month: "short" },
  weekday: { weekday: "long" },
  weekdayShort: { weekday: "narrow" },
};

export function formatDate(iso: ISODate, style: DateStyle = "dayMonth", numerals: Numerals = "latn"): string {
  return dtf(numerals, STYLES[style]).format(toUTC(iso));
}

/** Relative label in friendly Arabic: اليوم / أمس / بكرة-style words kept formal. */
export function relativeDayLabel(iso: ISODate, today: ISODate, numerals: Numerals = "latn"): string {
  const d = diffDays(iso, today);
  if (d === 0) return "اليوم";
  if (d === -1) return "أمس";
  if (d === 1) return "غدًا";
  if (d > 1 && d <= 10) return `بعد ${arabicCount(d, "day", numerals)}`;
  if (d < -1 && d >= -10) return `منذ ${arabicCount(-d, "day", numerals)}`;
  return formatDate(iso, "dayMonth", numerals);
}

const UNITS = {
  day: { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" },
  month: { one: "شهر", two: "شهرين", few: "أشهر", many: "شهرًا" },
  installment: { one: "قسط", two: "قسطين", few: "أقساط", many: "قسطًا" },
  bill: { one: "فاتورة", two: "فاتورتين", few: "فواتير", many: "فاتورة" },
  goal: { one: "هدف", two: "هدفين", few: "أهداف", many: "هدفًا" },
  transaction: { one: "عملية", two: "عمليتين", few: "عمليات", many: "عملية" },
} as const;

/** Correct Arabic counting: يوم واحد، يومين، ٣ أيام، ١١ يومًا، ١٠٠ يوم. */
export function arabicCount(n: number, unit: keyof typeof UNITS, numerals: Numerals = "latn"): string {
  const u = UNITS[unit];
  const num = new Intl.NumberFormat(`ar-AE-u-nu-${numerals}`).format(n);
  if (n === 0) return `${num} ${u.many}`;
  if (n === 1) return `${u.one} ${unit === "bill" || unit === "transaction" ? "واحدة" : "واحد"}`;
  if (n === 2) return u.two;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return `${num} ${u.few}`;
  if (mod100 >= 11 && mod100 <= 99) return `${num} ${u.many}`;
  return `${num} ${u.one}`;
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "نهارك سعيد";
  return "مساء الخير";
}
