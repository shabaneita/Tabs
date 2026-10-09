"use client";

import { Bell, ChevronLeft, CreditCard, Lock, NotebookPen, PiggyBank, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app/app-context";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { CategorySpendingRow } from "@/components/dashboard/category-spending";
import { GoalMiniCard } from "@/components/dashboard/goal-card";
import { HeroCard } from "@/components/dashboard/hero-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { BillOccurrenceRow } from "@/components/dashboard/upcoming-bills";
import { TransactionRow } from "@/components/expense/transaction-list";
import { useQuickAdd } from "@/components/expense/quick-add";
import { Amount, useNumerals } from "@/components/ui/amount";
import { SectionTitle } from "@/components/ui/card";
import { Avatar, EmptyState, ListGroup, Skeleton } from "@/components/ui/misc";
import { useNotifications } from "@/lib/data/hooks";
import { useMonthOverview } from "@/lib/data/insights-hook";
import { arabicCount, formatDate, greetingFor, hourInDubai } from "@/lib/dates";

export default function DashboardPage() {
  const { me, today } = useApp();
  const numerals = useNumerals();
  const router = useRouter();
  const { open } = useQuickAdd();
  const { data, isLoading } = useMonthOverview();
  const { data: notifications = [] } = useNotifications();
  const unread = notifications.filter((n) => !n.read_at).length;
  const firstName = me.profile.display_name.split(" ")[0] || "أهلًا";

  return (
    <div>
      {/* Top bar */}
      <header className="pt-safe flex items-center justify-between gap-3 pb-4 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/more/settings" aria-label="الإعدادات والحساب">
            <Avatar name={me.profile.display_name} color={me.profile.avatar_color} size={44} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-tight">
              {greetingFor(hourInDubai())}، {firstName}
            </p>
            <p className="text-sm text-foreground-muted">{formatDate(today, "month", numerals)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle userId={me.user.id} />
          <Link
            href="/notifications"
            className="pressable relative grid size-10 place-items-center rounded-full bg-card shadow-card ring-1 ring-border"
            aria-label={unread ? `الإشعارات (${unread} غير مقروءة)` : "الإشعارات"}
          >
            <Bell className="size-[18px]" />
            {unread ? <span className="absolute end-1.5 top-1.5 size-2.5 rounded-full bg-danger ring-2 ring-card" /> : null}
          </Link>
        </div>
      </header>

      {isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <HeroCard summary={data.summary} />

          {/* Budget alerts */}
          {data.insights.some((i) => i.severity === "critical" || i.severity === "warning") ? (
            <>
              <SectionTitle>تنبيهات الميزانية</SectionTitle>
              <div className="space-y-3">
                {data.insights
                  .filter((i) => i.severity === "critical" || i.severity === "warning")
                  .slice(0, 3)
                  .map((i) => (
                    <InsightCard key={i.id} insight={i} />
                  ))}
              </div>
            </>
          ) : null}

          {/* Spending by category */}
          <SectionTitle action={<MoreLink href="/budget" />}>المصروف حسب التصنيف</SectionTitle>
          {data.summary.actualTotalMinor === 0 ? (
            <ListGroup>
              <EmptyState
                icon={<ReceiptText />}
                title="لا توجد مصاريف مشتركة هذا الشهر بعد"
                description="سجّل أول مصروف وسيظهر هنا توزيع الصرف على التصنيفات مقارنة بالميزانية."
              />
            </ListGroup>
          ) : (
            <ListGroup>
              {data.summary.categories
                .filter((c) => c.actualMinor > 0)
                .slice(0, 5)
                .map((c) => (
                  <CategorySpendingRow key={c.categoryId} line={c} category={data.categories.find((x) => x.id === c.categoryId)} onClick={() => router.push("/budget")} />
                ))}
            </ListGroup>
          )}

          {/* Upcoming bills */}
          <SectionTitle action={<MoreLink href="/more/bills" />}>الفواتير القادمة</SectionTitle>
          {(() => {
            const upcoming = data.occurrences.filter((o) => o.status !== "paid" && o.daysUntil <= 14).slice(0, 4);
            return upcoming.length ? (
              <ListGroup>
                {upcoming.map((o) => (
                  <BillOccurrenceRow key={`${o.bill.id}:${o.dueDate}`} occ={o} />
                ))}
              </ListGroup>
            ) : (
              <ListGroup>
                <EmptyState
                  icon={<CreditCard />}
                  title="لا توجد فواتير مستحقة خلال أسبوعين"
                  description="أضف الإيجار وديوا والإنترنت لتصلك تذكيرات قبل مواعيدها."
                  action={
                    <Link href="/more/bills" className="text-sm font-semibold text-primary">
                      إدارة الفواتير
                    </Link>
                  }
                />
              </ListGroup>
            );
          })()}

          {/* Recent shared transactions */}
          <SectionTitle action={<MoreLink href="/expenses" />}>آخر المصاريف المشتركة</SectionTitle>
          {(() => {
            const recent = data.allTx.filter((t) => t.visibility === "shared").slice(0, 5);
            return recent.length ? (
              <ListGroup>
                {recent.map((t) => (
                  <TransactionRow key={t.id} tx={t} category={data.categories.find((c) => c.id === t.category_id)} compact />
                ))}
              </ListGroup>
            ) : (
              <ListGroup>
                <EmptyState
                  icon={<ReceiptText />}
                  title="لم تُسجَّل مصاريف مشتركة بعد"
                  action={
                    <button type="button" onClick={() => open()} className="text-sm font-semibold text-primary">
                      أضف مصروف
                    </button>
                  }
                />
              </ListGroup>
            );
          })()}

          {/* Personal shortcuts */}
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              مساحتي الخاصة <Lock className="size-4 text-foreground-subtle" />
            </span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Shortcut href="/expenses?scope=mine" icon={<ReceiptText />} title="مصاريفي الخاصة" value={<Amount minor={data.myPrivateMonth} />} />
            <Shortcut
              href="/more/income"
              icon={<Wallet />}
              title="دخلي"
              value={data.personalIncomeMinor ? <Amount minor={data.personalIncomeMinor} /> : <span className="text-foreground-subtle">غير مسجل</span>}
            />
            <Shortcut href="/more/goals" icon={<PiggyBank />} title="أهداف الادخار" value={<span>{data.goals.length ? arabicCount(data.goals.length, "goal", numerals) : "ابدأ هدفًا"}</span>} />
            <Shortcut href="/more/notes" icon={<NotebookPen />} title="ملاحظاتي" value={<span className="text-foreground-subtle">خاصة بك</span>} />
          </div>
          <p className="mt-2 px-1 text-xs text-foreground-subtle">هذه الأرقام تظهر لك وحدك ولا تدخل في ميزانية البيت.</p>

          {/* Savings progress */}
          {data.goals.length ? (
            <>
              <SectionTitle action={<MoreLink href="/more/goals" />}>أهداف الادخار</SectionTitle>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                {data.goals.map((g) => (
                  <GoalMiniCard key={g.id} goal={g} onClick={() => router.push("/more/goals")} />
                ))}
              </div>
            </>
          ) : null}

          {/* Recommendations */}
          {data.insights.some((i) => i.severity === "info" || i.severity === "positive") ? (
            <>
              <SectionTitle action={<MoreLink href="/analytics" label="ملخص الشهر" />}>توصيات ذكية</SectionTitle>
              <div className="space-y-3">
                {data.insights
                  .filter((i) => i.severity === "info" || i.severity === "positive")
                  .slice(0, 3)
                  .map((i) => (
                    <InsightCard key={i.id} insight={i} />
                  ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function MoreLink({ href, label = "عرض الكل" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="flex items-center gap-0.5 text-sm font-medium text-primary">
      {label}
      <ChevronLeft className="size-4" />
    </Link>
  );
}

function Shortcut({ href, icon, title, value }: { href: string; icon: React.ReactNode; title: string; value: React.ReactNode }) {
  return (
    <Link href={href} className="pressable surface-card flex flex-col gap-3 rounded-3xl p-4">
      <span className="grid size-10 place-items-center rounded-2xl bg-sage text-primary [&_svg]:size-5">{icon}</span>
      <span>
        <span className="block text-sm text-foreground-muted">{title}</span>
        <span className="mt-0.5 block text-[15px] font-semibold">{value}</span>
      </span>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="جارٍ التحميل">
      <Skeleton className="h-[300px] rounded-[28px]" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-32 rounded-3xl" />
    </div>
  );
}
