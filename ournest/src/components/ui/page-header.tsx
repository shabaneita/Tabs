"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Large-title page header with optional back button and trailing actions. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: boolean | string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header className={cn("pt-safe sticky top-0 z-30 -mx-4 mb-2 bg-background/85 px-4 backdrop-blur-xl", className)}>
      <div className="flex min-h-14 items-center justify-between gap-2 pt-2">
        <div className="flex min-w-0 items-center gap-1">
          {back ? (
            <button
              type="button"
              onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
              className="pressable -ms-2 grid size-10 place-items-center rounded-full text-foreground hover:bg-muted"
              aria-label="رجوع"
            >
              <ChevronRight className="size-6" />
            </button>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
            {subtitle ? <p className="truncate text-sm text-foreground-muted">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    </header>
  );
}
