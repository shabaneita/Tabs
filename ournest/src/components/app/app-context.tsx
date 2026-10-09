"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Me } from "@/lib/data/hooks";
import { todayInDubai, type ISODate } from "@/lib/dates";

export interface AppState {
  me: Me & { household: NonNullable<Me["household"]> };
  today: ISODate;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside the app shell");
  return ctx;
}

/** Today's Dubai date, refreshed when the app regains focus or the day rolls over. */
export function useDubaiToday(): ISODate {
  const [today, setToday] = useState(() => todayInDubai());
  useEffect(() => {
    const tick = () => setToday((prev) => {
      const now = todayInDubai();
      return now === prev ? prev : now;
    });
    const id = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}
