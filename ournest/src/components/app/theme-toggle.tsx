"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useInvalidate, qk } from "@/lib/data/hooks";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Light/Dark switch; the choice is remembered per user in user_settings. */
export function ThemeToggle({ userId, className }: { userId: string; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const invalidate = useInvalidate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={async () => {
        const next = dark ? "light" : "dark";
        setTheme(next);
        await getSupabase().from("user_settings").update({ theme: next }).eq("user_id", userId);
        invalidate(qk.me);
      }}
      aria-label={dark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
      className={cn("pressable grid size-10 place-items-center rounded-full bg-card text-foreground shadow-card ring-1 ring-border", className)}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
