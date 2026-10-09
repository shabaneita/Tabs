"use client";

import { AlertTriangle, Bell, CalendarClock, CheckCheck, CreditCard, PiggyBank, ReceiptText, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Amount, useNumerals } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ListGroup, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { qk, useInvalidate, useNotifications } from "@/lib/data/hooks";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/time";
import type { NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationKind, { icon: React.ElementType; cls: string }> = {
  shared_expense: { icon: ReceiptText, cls: "bg-primary-soft text-primary" },
  bill_due: { icon: CalendarClock, cls: "bg-warning-soft text-warning" },
  bill_overdue: { icon: AlertTriangle, cls: "bg-danger-soft text-danger" },
  budget_warning: { icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  budget_exceeded: { icon: AlertTriangle, cls: "bg-danger-soft text-danger" },
  installment_due: { icon: CreditCard, cls: "bg-info-soft text-info" },
  goal_behind: { icon: PiggyBank, cls: "bg-warning-soft text-warning" },
  member_joined: { icon: UserPlus, cls: "bg-primary-soft text-primary" },
};

export default function NotificationsPage() {
  const { me } = useApp();
  const numerals = useNumerals();
  const { data, isLoading } = useNotifications();
  const invalidate = useInvalidate();
  const unread = (data ?? []).filter((n) => !n.read_at);

  // Mark as read shortly after viewing.
  useEffect(() => {
    if (!unread.length) return;
    const t = setTimeout(async () => {
      await getSupabase().from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread.map((n) => n.id));
      invalidate(qk.notifications);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.length]);

  return (
    <div>
      <PageHeader
        title="الإشعارات"
        back
        actions={
          data?.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const { error } = await getSupabase().from("notifications").delete().eq("user_id", me.user.id).not("read_at", "is", null);
                if (error) return toast.error(arabicError(error));
                invalidate(qk.notifications);
              }}
            >
              <CheckCheck className="size-4" /> مسح المقروءة
            </Button>
          ) : null
        }
      />
      {isLoading ? (
        <Skeleton className="h-60 rounded-3xl" />
      ) : !data?.length ? (
        <EmptyState icon={<Bell />} title="لا توجد إشعارات" description="ستصلك هنا تذكيرات الفواتير وتنبيهات الميزانية والمصاريف المشتركة الجديدة." />
      ) : (
        <ListGroup>
          {data.map((n) => {
            const meta = ICONS[n.kind];
            const actor = me.members.find((m) => m.id === n.actor_id);
            const content = (
              <>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", meta.cls)}>
                  <meta.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{n.title}</span>
                    {!n.read_at ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" /> : null}
                  </span>
                  <span className="block truncate text-sm text-foreground-muted">
                    {actor && n.kind === "shared_expense" ? `${actor.display_name}: ` : ""}
                    {n.body}
                  </span>
                  <span className="block text-xs text-foreground-subtle">{timeAgo(n.created_at, numerals)}</span>
                </span>
                {n.amount_minor ? <Amount minor={n.amount_minor} className="shrink-0 text-sm font-semibold" /> : null}
              </>
            );
            return (
              <div key={n.id} className="group relative flex items-center">
                {n.link ? (
                  <Link href={n.link} className="flex flex-1 items-center gap-3 px-4 py-3.5 hover:bg-muted/50">
                    {content}
                  </Link>
                ) : (
                  <div className="flex flex-1 items-center gap-3 px-4 py-3.5">{content}</div>
                )}
                <button
                  type="button"
                  aria-label="حذف الإشعار"
                  className="p-3 text-foreground-subtle"
                  onClick={async () => {
                    await getSupabase().from("notifications").delete().eq("id", n.id);
                    invalidate(qk.notifications);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </ListGroup>
      )}
    </div>
  );
}
