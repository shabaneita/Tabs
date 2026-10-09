import type { Numerals } from "./money";
import { formatDate, todayInDubai } from "./dates";

/** "منذ ٥ دقائق" style label for timestamps. */
export function timeAgo(iso: string, numerals: Numerals = "latn", now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime()) / 1000;
  const n = (v: number) => new Intl.NumberFormat(`ar-AE-u-nu-${numerals}`).format(v);
  if (diff < 60) return "الآن";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return m === 1 ? "منذ دقيقة" : m === 2 ? "منذ دقيقتين" : m <= 10 ? `منذ ${n(m)} دقائق` : `منذ ${n(m)} دقيقة`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return h === 1 ? "منذ ساعة" : h === 2 ? "منذ ساعتين" : h <= 10 ? `منذ ${n(h)} ساعات` : `منذ ${n(h)} ساعة`;
  }
  return formatDate(todayInDubai(new Date(iso)), "dayMonth", numerals);
}
