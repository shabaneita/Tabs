"use client";

import { Switch as RSwitch } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-strong",
      )}
    >
      <RSwitch.Thumb className="block size-[27px] translate-x-[-2px] rounded-full bg-white shadow-md transition-transform duration-200 ease-[var(--ease-ios)] data-[state=checked]:translate-x-[-22px]" />
    </RSwitch.Root>
  );
}
