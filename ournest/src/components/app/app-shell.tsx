"use client";

import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { NumeralsContext } from "@/components/ui/amount";
import { QuickAddProvider, useQuickAdd } from "@/components/expense/quick-add";
import { useMeQuery } from "@/lib/data/hooks";
import { haptic } from "@/lib/utils";
import { AlertSync } from "./alert-sync";
import { AppContext, useDubaiToday, type AppState } from "./app-context";
import { BottomNav } from "./bottom-nav";
import { Splash } from "./splash";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading, isError } = useMeQuery();
  const today = useDubaiToday();
  const { setTheme } = useTheme();
  const themeSynced = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!me.household) router.replace("/onboarding");
  }, [me, isLoading, router, pathname]);

  // Apply the user's saved theme once per session (remembered per user).
  useEffect(() => {
    if (me && !themeSynced.current) {
      themeSynced.current = true;
      setTheme(me.settings.theme);
    }
  }, [me, setTheme]);

  const state = useMemo<AppState | null>(
    () => (me?.household ? { me: me as AppState["me"], today } : null),
    [me, today],
  );

  if (isError) return <Splash message="تعذّر تحميل البيانات. تأكد من الاتصال ثم أعد المحاولة." />;
  if (!state) return <Splash />;

  const printOnly = pathname.startsWith("/report");

  return (
    <AppContext.Provider value={state}>
      <NumeralsContext.Provider value={state.me.settings.numerals}>
        <QuickAddProvider>
          <div className={printOnly ? "" : "pb-nav mx-auto min-h-dvh w-full max-w-lg px-4"}>{children}</div>
          {printOnly ? null : (
            <>
              <QuickAddFab />
              <BottomNav />
              <AlertSync />
            </>
          )}
        </QuickAddProvider>
      </NumeralsContext.Provider>
    </AppContext.Provider>
  );
}

function QuickAddFab() {
  const { open } = useQuickAdd();
  const router = useRouter();
  // Home-screen shortcut (manifest) opens the entry sheet directly: /?add=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "1") {
      router.replace(window.location.pathname);
      open();
    }
  }, [open, router]);
  return (
    <motion.button
      type="button"
      onClick={() => {
        haptic(10);
        open();
      }}
      whileTap={{ scale: 0.92 }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      aria-label="أضف مصروف"
      data-testid="fab-add"
      className="no-print fixed z-40 grid size-[60px] place-items-center rounded-full bg-primary text-primary-foreground shadow-float"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 16px)", insetInlineEnd: "max(1.25rem, calc((100vw - 32rem) / 2 + 1.25rem))" }}
    >
      <Plus className="size-7" strokeWidth={2.4} />
    </motion.button>
  );
}
