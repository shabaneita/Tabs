"use client";

import { Delete } from "lucide-react";
import type { KeypadKey } from "@/lib/keypad";
import { localizeDigits } from "@/lib/money";
import { cn, haptic } from "@/lib/utils";
import { useNumerals } from "./amount";

const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

/** Large, thumb-friendly numeric keypad (calculator layout, LTR like iOS). */
export function Keypad({ onKey, className }: { onKey: (k: KeypadKey) => void; className?: string }) {
  const numerals = useNumerals();
  return (
    <div dir="ltr" className={cn("grid grid-cols-3 gap-2", className)}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            haptic();
            onKey(k);
          }}
          onContextMenu={(e) => {
            if (k === "back") {
              e.preventDefault();
              onKey("clear");
            }
          }}
          aria-label={k === "back" ? "حذف" : k === "." ? "فاصلة عشرية" : k}
          className="pressable grid h-[52px] place-items-center rounded-2xl bg-muted text-[22px] font-semibold text-foreground active:bg-sage-strong"
        >
          {k === "back" ? <Delete className="size-6" strokeWidth={1.8} /> : k === "." ? (numerals === "arab" ? "٫" : ".") : localizeDigits(k, numerals)}
        </button>
      ))}
    </div>
  );
}
