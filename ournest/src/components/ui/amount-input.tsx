"use client";

import { forwardRef, useState } from "react";
import { minorToInput, normalizeDigits, parseAmountToMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";

/**
 * Amount field with the iOS decimal keypad. Value is fils (integer) or
 * null; accepts Arabic-Indic digits. `allowZero` permits 0.
 */
export const AmountInput = forwardRef<
  HTMLInputElement,
  { value: number | null; onChange: (minor: number | null) => void; allowZero?: boolean; id?: string; className?: string; "aria-label"?: string; autoFocus?: boolean }
>(function AmountInput({ value, onChange, allowZero, id, className, autoFocus, ...rest }, ref) {
  const [text, setText] = useState(value !== null && value !== undefined ? minorToInput(value) : "");
  return (
    <div className={cn("relative", className)}>
      <input
        ref={ref}
        id={id}
        dir="ltr"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        className={cn(inputClass, "num pe-4 ps-14 text-left text-lg font-semibold")}
        value={text}
        aria-label={rest["aria-label"]}
        onChange={(e) => {
          const raw = normalizeDigits(e.target.value).replace(/[^\d.,]/g, "");
          setText(raw);
          const trimmed = raw.replace(/,/g, "").trim();
          if (allowZero && (trimmed === "0" || trimmed === "" || /^0*\.?0*$/.test(trimmed))) onChange(trimmed === "" ? null : 0);
          else onChange(parseAmountToMinor(raw));
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-medium text-foreground-subtle">د.إ</span>
    </div>
  );
});
