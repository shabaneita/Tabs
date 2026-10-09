"use client";

import { BarChart3, Home, LayoutGrid, PieChart, ReceiptText } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "الرئيسية", icon: Home, match: (p: string) => p === "/" },
  { href: "/expenses", label: "المصاريف", icon: ReceiptText, match: (p: string) => p.startsWith("/expenses") },
  { href: "/budget", label: "الميزانية", icon: PieChart, match: (p: string) => p.startsWith("/budget") },
  { href: "/analytics", label: "التحليلات", icon: BarChart3, match: (p: string) => p.startsWith("/analytics") },
  { href: "/more", label: "المزيد", icon: LayoutGrid, match: (p: string) => p.startsWith("/more") || p.startsWith("/notifications") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-lg items-stretch justify-around px-1">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "pressable relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-foreground-subtle",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute top-1.5 h-8 w-14 rounded-full bg-primary-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                ) : null}
                <Icon className="relative z-10 size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
