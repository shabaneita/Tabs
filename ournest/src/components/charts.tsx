"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Amount, Num, useNumerals } from "@/components/ui/amount";
import { formatMinor, percentOf } from "@/lib/money";
import type { Category } from "@/lib/types";

/**
 * Charts. Colours come from the validated categorical slots (--series-1..8)
 * assigned by each category's STABLE position, never by rank, so a filter
 * never repaints a category. Charts sit in an LTR box with reversed time
 * axes so time reads right-to-left like Arabic text.
 */

export const OTHER_COLOR = "var(--series-other)";

export function categorySeriesColor(categoryId: string, categories: Category[]): string {
  const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  const idx = ordered.findIndex((c) => c.id === categoryId);
  return idx >= 0 && idx < 8 ? `var(--series-${idx + 1})` : OTHER_COLOR;
}

type Datum = { id: string; name: string; value: number; color: string };

/** Donut with centre total and a value legend that doubles as the table view. */
export function CategoryDonut({ data, total }: { data: Datum[]; total: number }) {
  return (
    <div>
      <div dir="ltr" className="relative mx-auto h-[210px] w-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={data.length > 1 ? 1.5 : 0} stroke="var(--card)" strokeWidth={2} isAnimationActive animationDuration={700}>
              {data.map((d) => (
                <Cell key={d.id} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<DatumTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" dir="rtl">
          <div>
            <p className="text-xs text-foreground-muted">الإجمالي</p>
            <Amount minor={total} className="text-lg font-bold" />
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2" aria-label="توزيع المصروف حسب التصنيف">
        {data.map((d) => (
          <li key={d.id} className="flex items-center gap-3 text-sm">
            <span className="size-3 shrink-0 rounded-[4px]" style={{ background: d.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="text-foreground-subtle">
              <Num value={percentOf(d.value, total)} />٪
            </span>
            <Amount minor={d.value} className="w-24 justify-end font-semibold" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DatumTooltip({ active, payload, total }: { active?: boolean; payload?: { payload: Datum }[]; total: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div dir="rtl" className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
      <p className="font-semibold">{d.name}</p>
      <p className="mt-0.5 text-foreground-muted">
        <Amount minor={d.value} className="font-semibold text-foreground" /> · <Num value={percentOf(d.value, total)} />٪
      </p>
    </div>
  );
}

function useAxisFormatter() {
  const numerals = useNumerals();
  return (v: number) => formatMinor(v, { numerals, compact: true, fils: "never" });
}

const axisProps = {
  tick: { fill: "var(--chart-axis)", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "var(--chart-grid)" },
} as const;

/** Single-series monthly totals. */
export function MonthlyBars({ data, highlightLast = true }: { data: { label: string; value: number; key: string }[]; highlightLast?: boolean }) {
  const fmt = useAxisFormatter();
  return (
    <div dir="ltr" className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" reversed {...axisProps} interval={0} />
          <YAxis orientation="right" width={44} tickFormatter={fmt} {...axisProps} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ValueTooltip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive animationDuration={600}>
            {data.map((d, i) => (
              <Cell key={d.key} fill={highlightLast && i === data.length - 1 ? "var(--primary)" : "color-mix(in oklab, var(--primary) 45%, var(--card))"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ValueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p, i) =>
        p.value === null || p.value === undefined ? null : (
          <p key={i} className="flex items-center gap-2 text-foreground-muted">
            {payload.length > 1 ? <span className="size-2 rounded-full" style={{ background: p.color }} /> : null}
            {p.name && payload.length > 1 ? <span>{p.name}</span> : null}
            <Amount minor={p.value} className="font-semibold text-foreground" />
          </p>
        ),
      )}
    </div>
  );
}

/** Cumulative spend this month vs a straight budget pace line. */
export function TrendLine({ data }: { data: { day: number; cumulativeMinor: number | null; paceMinor: number }[] }) {
  const fmt = useAxisFormatter();
  const numerals = useNumerals();
  return (
    <div dir="ltr" className="h-[210px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="day" reversed {...axisProps} tickFormatter={(d: number) => new Intl.NumberFormat(`ar-AE-u-nu-${numerals}`).format(d)} interval={6} />
          <YAxis orientation="right" width={44} tickFormatter={fmt} {...axisProps} axisLine={false} />
          <Tooltip content={<ValueTooltip />} labelFormatter={(d) => `يوم ${d}`} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, direction: "rtl", paddingBottom: 8 }} />
          <Line name="وتيرة الميزانية" dataKey="paceMinor" stroke="var(--chart-axis)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line name="المصروف التراكمي" dataKey="cumulativeMinor" stroke="var(--primary)" strokeWidth={2} dot={false} connectNulls={false} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} animationDuration={700} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two same-unit series per month (e.g. income vs spending): one axis. */
export function PairedBars({
  data,
  aName,
  bName,
}: {
  data: { label: string; key: string; a: number; b: number }[];
  aName: string;
  bName: string;
}) {
  const fmt = useAxisFormatter();
  return (
    <div dir="ltr" className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" reversed {...axisProps} interval={0} />
          <YAxis orientation="right" width={44} tickFormatter={fmt} {...axisProps} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ValueTooltip />} />
          <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, direction: "rtl", paddingBottom: 8 }} />
          <Bar name={aName} dataKey="a" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar name={bName} dataKey="b" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Planned vs actual per category as HTML bars (RTL-native, labelled). */
export function BudgetVsActual({ rows }: { rows: { id: string; name: string; planned: number; actual: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual)));
  return (
    <div className="space-y-3.5">
      <div className="flex gap-4 text-xs text-foreground-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-[color-mix(in_oklab,var(--primary)_25%,var(--card))]" /> المخطط
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-primary" /> الفعلي
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-danger" /> تجاوز
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.id}>
          <div className="mb-1 flex justify-between gap-2 text-[13px]">
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 text-foreground-muted">
              <Amount minor={r.actual} className="font-semibold text-foreground" /> / <Amount minor={r.planned} hideCurrency />
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted">
            <div className="absolute inset-y-0 right-0 rounded-full bg-[color-mix(in_oklab,var(--primary)_25%,var(--card))]" style={{ width: `${(r.planned / max) * 100}%` }} />
            <div
              className={`absolute inset-y-0 right-0 rounded-full ${r.actual > r.planned ? "bg-danger" : "bg-primary"}`}
              style={{ width: `${(r.actual / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
