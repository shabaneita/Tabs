/** Private income totals. Only ever computed from the owner's own rows. */
import { monthEnd, monthStart, type ISODate } from "../dates";
import type { IncomeSource } from "../types";

type Income = Pick<IncomeSource, "frequency" | "amount_minor" | "starts_on" | "ends_on">;

export function isIncomeInMonth(src: Income, month: ISODate): boolean {
  const start = monthStart(month);
  const end = monthEnd(month);
  if (src.frequency === "one_time") return src.starts_on >= start && src.starts_on <= end;
  return monthStart(src.starts_on) <= start && (!src.ends_on || src.ends_on >= start);
}

export function monthlyIncomeTotal(sources: Income[], month: ISODate): number {
  return sources.filter((s) => isIncomeInMonth(s, month)).reduce((sum, s) => sum + s.amount_minor, 0);
}
