import { describe, expect, it } from "vitest";
import { formatAED, formatMinor, minorToInput, normalizeDigits, parseAmountToMinor, percentOf, roundToStep, sumMinor } from "@/lib/money";

describe("parseAmountToMinor", () => {
  it.each([
    ["80", 8000],
    ["1,250.5", 125050],
    ["1250.05", 125005],
    ["0.1", 10],
    [" 42 ", 4200],
    ["١٢٥٠٫٥", 125050],
    ["۳۰۰", 30000],
    ["99.", 9900],
  ])("parses %s", (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it.each(["", "0", "0.00", "-5", "1.234", "abc", "1e5", "12..3", "1000000001"])("rejects %s", (input) => {
    expect(parseAmountToMinor(input)).toBeNull();
  });

  it("avoids floating point drift (0.1 + 0.2 problem)", () => {
    const a = parseAmountToMinor("0.1")!;
    const b = parseAmountToMinor("0.2")!;
    expect(a + b).toBe(30);
    expect(parseAmountToMinor("19.99")! * 3).toBe(5997);
  });
});

describe("formatting", () => {
  it("formats whole dirhams without fils and keeps exact fils", () => {
    expect(formatMinor(1400000)).toBe("14,000");
    expect(formatMinor(125050)).toBe("1,250.50");
    expect(formatMinor(5)).toBe("0.05");
    expect(formatMinor(125050, { fils: "never" })).toBe("1,251");
    expect(formatMinor(100, { fils: "always" })).toBe("1.00");
  });

  it("supports Arabic-Indic numerals", () => {
    expect(formatMinor(125050, { numerals: "arab" })).toBe("١٬٢٥٠٫٥٠");
  });

  it("signs and labels amounts", () => {
    expect(formatMinor(-8250)).toBe("−82.50");
    expect(formatMinor(8250, { signed: true })).toBe("+82.50");
    expect(formatAED(82500)).toBe("825 د.إ");
  });

  it("round-trips input strings", () => {
    expect(minorToInput(125050)).toBe("1250.50");
    expect(minorToInput(8000)).toBe("80");
    expect(parseAmountToMinor(minorToInput(123456789))).toBe(123456789);
  });
});

describe("helpers", () => {
  it("normalizes digits", () => expect(normalizeDigits("١٬٢٣٤٫٥")).toBe("1,234.5"));
  it("sums", () => expect(sumMinor([1, 2, 3])).toBe(6));
  it("percent", () => {
    expect(percentOf(825, 1000)).toBe(83);
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(5, 0)).toBe(100);
  });
  it("rounds to step", () => expect(roundToStep(7300, 50)).toBe(5000));
});
