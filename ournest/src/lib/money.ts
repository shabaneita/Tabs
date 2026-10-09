/**
 * Money helpers. All amounts are integer minor units (fils): 1 AED = 100 fils.
 * Never use floating point arithmetic on money; parse strings digit-by-digit.
 */

export type Numerals = "latn" | "arab";

export const MAX_AMOUNT_MINOR = 100_000_000_000; // 1 billion AED, matches the DB check

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic / Persian digits and separators to ASCII. */
export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    const e = EXTENDED_ARABIC_INDIC.indexOf(ch);
    if (a >= 0) out += String(a);
    else if (e >= 0) out += String(e);
    else if (ch === "٫") out += ".";
    else if (ch === "٬" || ch === "،") out += ",";
    else out += ch;
  }
  return out;
}

/**
 * Parses a user-typed amount ("1,250.5", "١٢٥٠٫٥", "  80 ") into fils.
 * Returns null for anything that is not a positive amount with at most two
 * decimals.
 */
export function parseAmountToMinor(input: string): number | null {
  const s = normalizeDigits(input).replace(/[\s,]/g, "");
  if (!/^\d{1,12}(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

/** "125050" -> "1250.50" (plain, for inputs). */
export function minorToInput(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}

const formatters = new Map<string, Intl.NumberFormat>();
function nf(numerals: Numerals, fractionDigits: number, compact = false): Intl.NumberFormat {
  const key = `${numerals}:${fractionDigits}:${compact}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(`ar-AE-u-nu-${numerals}`, {
      minimumFractionDigits: compact ? 0 : fractionDigits,
      maximumFractionDigits: compact ? 1 : fractionDigits,
      ...(compact ? { notation: "compact" as const } : {}),
    });
    formatters.set(key, f);
  }
  return f;
}

export function localizeDigits(ascii: string, numerals: Numerals): string {
  if (numerals === "latn") return ascii;
  return ascii.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

export type FormatMoneyOptions = {
  numerals?: Numerals;
  /** "auto" shows fils only when non-zero. */
  fils?: "auto" | "always" | "never";
  compact?: boolean;
  signed?: boolean;
};

/** Formats fils as a localized number string WITHOUT the currency label. */
export function formatMinor(minor: number, opts: FormatMoneyOptions = {}): string {
  const { numerals = "latn", fils = "auto", compact = false, signed = false } = opts;
  const abs = Math.abs(minor);
  const showFils = fils === "always" || (fils === "auto" && abs % 100 !== 0);
  // Integer math for the whole part; fraction appended separately to avoid float drift.
  const whole = Math.floor(abs / 100);
  let body: string;
  if (compact && abs >= 1_000_000) {
    body = nf(numerals, 0, true).format(abs / 100);
  } else if (showFils) {
    const fracDigits = String(abs % 100).padStart(2, "0");
    const decimal = numerals === "arab" ? "٫" : ".";
    body = nf(numerals, 0).format(whole) + decimal + localizeDigits(fracDigits, numerals);
  } else {
    body = nf(numerals, 0).format(fils === "never" ? Math.round(abs / 100) : whole);
  }
  const sign = minor < 0 ? "−" : signed && minor > 0 ? "+" : "";
  return sign + body;
}

export const CURRENCY_LABEL = "د.إ";

/** Plain-text amount with currency, for notifications, CSV summaries, aria-labels. */
export function formatAED(minor: number, opts: FormatMoneyOptions = {}): string {
  return `${formatMinor(minor, opts)} ${CURRENCY_LABEL}`;
}

export function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Integer percentage (0..n) of part/whole; 0 when whole is 0. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return part > 0 ? 100 : 0;
  return Math.round((part / whole) * 100);
}

/** Rounds fils to the nearest whole multiple of `stepAED` dirhams. */
export function roundToStep(minor: number, stepAED: number): number {
  const step = stepAED * 100;
  return Math.round(minor / step) * step;
}

/** Plain localized integer (counts, percentages). */
export function formatNumber(n: number, numerals: Numerals = "latn"): string {
  return nf(numerals, 0).format(Math.round(n));
}

export function formatPercent(n: number, numerals: Numerals = "latn"): string {
  return `${formatNumber(n, numerals)}٪`;
}
