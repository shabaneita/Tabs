"use client";

import {
  Activity, Bell, CalendarDays, ChevronLeft, CreditCard, FileDown, Home, Landmark, Lock, NotebookPen, PiggyBank, Receipt, Settings, ShieldCheck, Tags, Wallet,
} from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app/app-context";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";

type Item = { href: string; label: string; icon: React.ElementType; hint?: string; private?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "مالية البيت",
    items: [
      { href: "/more/bills", label: "الفواتير القادمة", icon: Receipt, hint: "الإيجار، ديوا، الإنترنت…" },
      { href: "/more/installments", label: "الأقساط والالتزامات", icon: CreditCard },
      { href: "/more/goals", label: "أهداف الادخار", icon: PiggyBank },
      { href: "/more/calendar", label: "التقويم المالي", icon: CalendarDays },
      { href: "/more/activity", label: "نشاط البيت", icon: Activity },
    ],
  },
  {
    title: "مساحتي الخاصة",
    items: [
      { href: "/more/income", label: "دخلي", icon: Wallet, private: true },
      { href: "/more/accounts", label: "حساباتي", icon: Landmark, private: true },
      { href: "/more/notes", label: "ملاحظاتي المالية", icon: NotebookPen, private: true },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { href: "/more/household", label: "إدارة البيت والدعوات", icon: Home },
      { href: "/more/categories", label: "التصنيفات", icon: Tags },
      { href: "/notifications", label: "الإشعارات", icon: Bell },
      { href: "/more/export", label: "تصدير البيانات", icon: FileDown },
      { href: "/more/privacy", label: "الخصوصية والأمان", icon: ShieldCheck },
      { href: "/more/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

export default function MorePage() {
  const { me } = useApp();
  return (
    <div>
      <PageHeader title="المزيد" />
      <Link href="/more/settings" className="pressable surface-card mb-6 flex items-center gap-4 rounded-3xl p-4">
        <Avatar name={me.profile.display_name} color={me.profile.avatar_color} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{me.profile.display_name}</p>
          <p className="truncate text-sm text-foreground-muted">
            {me.household.name}
            {me.partner ? ` · مع ${me.partner.display_name}` : " · بانتظار انضمام شريكك"}
          </p>
        </div>
        <ChevronLeft className="size-5 text-foreground-subtle" />
      </Link>

      {GROUPS.map((g) => (
        <section key={g.title} className="mb-6">
          <h2 className="mb-2 px-2 text-sm font-semibold text-foreground-muted">{g.title}</h2>
          <div className="surface-card divide-y divide-border overflow-hidden rounded-3xl">
            {g.items.map((item) => (
              <Link key={item.href} href={item.href} className="pressable flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50">
                <span className="grid size-9 place-items-center rounded-xl bg-sage text-primary">
                  <item.icon className="size-[18px]" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 text-[15px] font-medium">
                    {item.label}
                    {item.private ? <Lock className="size-3.5 text-foreground-subtle" aria-label="خاص" /> : null}
                  </span>
                  {item.hint ? <span className="block text-xs text-foreground-subtle">{item.hint}</span> : null}
                </span>
                <ChevronLeft className="size-5 text-foreground-subtle" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
