"use client";

import { createContext, useContext } from "react";
import { CURRENCY_LABEL, formatMinor, type FormatMoneyOptions, type Numerals } from "@/lib/money";
import { cn } from "@/lib/utils";

export const NumeralsContext = createContext<Numerals>("latn");
export const useNumerals = () => useContext(NumeralsContext);

/**
 * Bidi-safe money display: the number is an isolated LTR run with tabular
 * digits, followed by the currency label — correct inside any Arabic text.
 */
export function Amount({
  minor,
  className,
  currencyClassName,
  hideCurrency,
  testId,
  ...opts
}: { minor: number; className?: string; currencyClassName?: string; hideCurrency?: boolean; testId?: string } & Omit<FormatMoneyOptions, "numerals">) {
  const numerals = useNumerals();
  const text = formatMinor(minor, { ...opts, numerals });
  return (
    <span className={cn("inline-flex items-baseline gap-1 whitespace-nowrap", className)} data-testid={testId}>
      <span className="num">{text}</span>
      {hideCurrency ? null : <span className={cn("text-[0.7em] font-medium opacity-70", currencyClassName)}>{CURRENCY_LABEL}</span>}
    </span>
  );
}

export function Num({ value, className }: { value: number; className?: string }) {
  const numerals = useNumerals();
  return <span className={cn("num", className)}>{new Intl.NumberFormat(`ar-AE-u-nu-${numerals}`).format(value)}</span>;
}
