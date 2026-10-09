"use client";

import { Activity } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Amount, useNumerals } from "@/components/ui/amount";
import { Avatar, EmptyState, ListGroup, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { useActivity } from "@/lib/data/hooks";
import { timeAgo } from "@/lib/time";
import type { ActivityLog } from "@/lib/types";

const ENTITY: Record<string, string> = {
  transactions: "مصروفًا مشتركًا",
  recurring_bills: "فاتورة",
  installment_plans: "قسطًا",
  savings_goals: "هدف ادخار",
};

function describe(a: ActivityLog): string {
  const what = ENTITY[a.entity_type] ?? "عنصرًا";
  switch (a.action) {
    case "created":
      return `أضاف ${what}`;
    case "updated":
      return `عدّل ${what}`;
    case "deleted":
      return `حذف ${what}`;
    case "shared":
      return `شارك ${what} مع البيت`;
    case "paid":
      return "سجّل دفعة قسط";
    case "contributed":
      return "أضاف مبلغًا لهدف";
    case "joined":
      return "انضم إلى البيت 🎉";
  }
}

export default function ActivityPage() {
  const { me } = useApp();
  const numerals = useNumerals();
  const { data, isLoading } = useActivity(100);
  return (
    <div>
      <PageHeader title="نشاط البيت" subtitle="ما تغيّر في السجلات المشتركة فقط" back="/more" />
      {isLoading ? (
        <Skeleton className="h-60 rounded-3xl" />
      ) : !data?.length ? (
        <EmptyState icon={<Activity />} title="لا يوجد نشاط بعد" description="هنا تظهر الإضافات والتعديلات على المصاريف والفواتير والأهداف المشتركة." />
      ) : (
        <ListGroup>
          {data.map((a) => {
            const actor = me.members.find((m) => m.id === a.actor_id);
            const isMe = a.actor_id === me.user.id;
            return (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3.5" data-testid="activity-item">
                <Avatar name={actor?.display_name ?? "؟"} color={actor?.avatar_color ?? "sage"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">
                    <span className="font-semibold">{isMe ? "أنت" : actor?.display_name ?? "عضو سابق"}</span> {describe(a)}
                  </p>
                  {a.title ? <p className="truncate text-sm text-foreground-muted">{a.title}</p> : null}
                  <p className="mt-0.5 text-xs text-foreground-subtle">{timeAgo(a.created_at, numerals)}</p>
                </div>
                {a.amount_minor ? <Amount minor={a.amount_minor} className="shrink-0 text-sm font-semibold" /> : null}
              </div>
            );
          })}
        </ListGroup>
      )}
    </div>
  );
}
