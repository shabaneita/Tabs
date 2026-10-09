import { describe, expect, it } from "vitest";
import {
  addDays, addMonths, arabicCount, diffDays, formatDate, isISODate, lastMonths, monthElapsedFraction, monthEnd,
  relativeDayLabel, todayInDubai,
} from "@/lib/dates";

describe("Dubai civil dates", () => {
  it("uses Dubai time, not the device's time zone", () => {
    // 21:30 UTC on 9 Oct is already 10 Oct (01:30) in Dubai (UTC+4).
    expect(todayInDubai(new Date("2026-10-09T21:30:00Z"))).toBe("2026-10-10");
    expect(todayInDubai(new Date("2026-10-09T19:59:00Z"))).toBe("2026-10-09");
  });

  it("clamps month arithmetic to month ends", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("does day maths across DST of the device zone", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(diffDays("2026-11-02", "2026-10-31")).toBe(2);
  });

  it("validates ISO dates", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
  });

  it("computes month helpers", () => {
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(lastMonths("2026-10-20", 3)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(monthElapsedFraction("2026-10-01", "2026-10-31")).toBe(1);
    expect(monthElapsedFraction("2026-10-01", "2026-09-30")).toBe(0);
  });
});

describe("Arabic formatting", () => {
  it("formats month names in Arabic", () => {
    expect(formatDate("2026-10-09", "month")).toBe("أكتوبر 2026");
    expect(formatDate("2026-10-09", "dayMonth", "arab")).toBe("٩ أكتوبر");
  });

  it("counts with correct Arabic plural forms", () => {
    expect(arabicCount(1, "day")).toBe("يوم واحد");
    expect(arabicCount(2, "day")).toBe("يومين");
    expect(arabicCount(3, "day")).toBe("3 أيام");
    expect(arabicCount(11, "day")).toBe("11 يومًا");
    expect(arabicCount(100, "day")).toBe("100 يوم");
    expect(arabicCount(2, "bill")).toBe("فاتورتين");
  });

  it("labels relative days", () => {
    expect(relativeDayLabel("2026-10-09", "2026-10-09")).toBe("اليوم");
    expect(relativeDayLabel("2026-10-08", "2026-10-09")).toBe("أمس");
    expect(relativeDayLabel("2026-10-12", "2026-10-09")).toBe("بعد 3 أيام");
  });
});
