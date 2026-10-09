"use client";

import { FileDown, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { useCategories, useIncome } from "@/lib/data/hooks";
import { loadTransactions } from "@/lib/data/hooks";
import { downloadText, toCSV } from "@/lib/csv";
import { addMonths, monthStart } from "@/lib/dates";
import { filterByScope } from "@/lib/finance/analytics";
import { exportTransactionsCSV } from "@/lib/export";
import { incomeKindLabel } from "@/lib/labels";
import { minorToInput } from "@/lib/money";
import type { Scope } from "@/lib/types";

export default function ExportPage() {
  const { me, today } = useApp();
  const { data: categories = [] } = useCategories();
  const { data: income = [] } = useIncome();
  const [scope, setScope] = useState<Scope>("household");
  const [from, setFrom] = useState(addMonths(monthStart(today), -11));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <PageHeader title="تصدير البيانات" back="/more" />
      <Card className="space-y-4 p-5">
        <p className="font-semibold">المصاريف (CSV)</p>
        <Segmented
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: "household", label: "البيت" },
            { value: "mine", label: "الخاص بي" },
            { value: "all", label: "الكل" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="من" htmlFor="efrom">
            <Input id="efrom" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </Field>
          <Field label="إلى" htmlFor="eto">
            <Input id="eto" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </Field>
        </div>
        <Button
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = filterByScope(await loadTransactions(from, to), scope, me.user.id);
              exportTransactionsCSV(rows, categories, me.members, `بيتنا-مصاريف-${from}-${to}-${scope}.csv`);
            } catch {
              toast.error("تعذّر التصدير");
            } finally {
              setBusy(false);
            }
          }}
        >
          <FileDown className="size-4" /> تنزيل CSV
        </Button>
        <p className="text-xs text-foreground-subtle">الملف بترميز UTF-8 ويفتح بشكل صحيح في Excel وNumbers.</p>
      </Card>

      <Card className="mt-3 space-y-3 p-5">
        <p className="font-semibold">تقرير PDF</p>
        <p className="text-sm text-foreground-muted">تقرير شهري منسق بالعربية. اختر «حفظ كـ PDF» من نافذة الطباعة (في iPhone: مشاركة ← طباعة ← مشاركة كـ PDF).</p>
        <Link href={`/report?month=${today.slice(0, 7)}&scope=household`} className={buttonVariants({ variant: "secondary", block: true })}>
          <FileText className="size-4" /> تقرير هذا الشهر
        </Link>
      </Card>

      <Card className="mt-3 space-y-3 p-5">
        <p className="flex items-center gap-1.5 font-semibold">
          دخلي (CSV) <Lock className="size-4 text-foreground-subtle" />
        </p>
        <Button
          variant="secondary"
          block
          disabled={!income.length}
          onClick={() =>
            downloadText(
              "بيتنا-دخلي.csv",
              toCSV(income, [
                { header: "الاسم", value: (r) => r.name },
                { header: "النوع", value: (r) => incomeKindLabel(r.kind) },
                { header: "التكرار", value: (r) => (r.frequency === "monthly" ? "شهري" : "مرة واحدة") },
                { header: "المبلغ (د.إ)", value: (r) => minorToInput(r.amount_minor) },
                { header: "من", value: (r) => r.starts_on },
                { header: "إلى", value: (r) => r.ends_on ?? "" },
              ]),
            )
          }
        >
          <FileDown className="size-4" /> تنزيل
        </Button>
      </Card>
    </div>
  );
}
