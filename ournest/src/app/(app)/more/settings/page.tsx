"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Moon, Share, SquarePlus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar, ListGroup } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { qk, useInvalidate } from "@/lib/data/hooks";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import type { UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["emerald", "sage", "sand", "rose", "sky", "violet"];

export default function SettingsPage() {
  const { me } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const { setTheme } = useTheme();
  const [name, setName] = useState(me.profile.display_name);
  const s = me.settings;

  async function updateSettings(patch: Partial<UserSettings>) {
    const { error } = await getSupabase().from("user_settings").update(patch).eq("user_id", me.user.id);
    if (error) return toast.error(arabicError(error));
    await invalidate(qk.me);
  }
  async function updateProfile(patch: { display_name?: string; avatar_color?: string }) {
    const { error } = await getSupabase().from("profiles").update(patch).eq("id", me.user.id);
    if (error) return toast.error(arabicError(error));
    await invalidate(qk.me);
    toast.success("تم الحفظ");
  }

  return (
    <div>
      <PageHeader title="الإعدادات" back="/more" />

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={name || "؟"} color={me.profile.avatar_color} size={56} />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{me.profile.display_name}</p>
            <p className="ltr-isolate truncate text-sm text-foreground-muted">{me.user.email}</p>
          </div>
        </div>
        <Field label="الاسم الظاهر لشريكك" htmlFor="dname" className="mt-4">
          <div className="flex gap-2">
            <Input id="dname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <Button variant="secondary" className="h-12" disabled={!name.trim() || name === me.profile.display_name} onClick={() => updateProfile({ display_name: name.trim() })}>
              حفظ
            </Button>
          </div>
        </Field>
        <div className="mt-4 flex gap-3">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`لون ${c}`}
              aria-pressed={me.profile.avatar_color === c}
              onClick={() => updateProfile({ avatar_color: c })}
              className={cn("size-9 rounded-full ring-offset-2 ring-offset-card", me.profile.avatar_color === c && "ring-2 ring-primary")}
              style={{ background: `var(--cat-${c})` }}
            />
          ))}
        </div>
      </Card>

      <Section title="المظهر">
        <div className="p-4">
          <Segmented
            ariaLabel="المظهر"
            value={s.theme}
            onChange={(v) => {
              setTheme(v);
              updateSettings({ theme: v });
            }}
            options={[
              { value: "system", label: "تلقائي", icon: <Monitor className="size-4" /> },
              { value: "light", label: "فاتح", icon: <Sun className="size-4" /> },
              { value: "dark", label: "داكن", icon: <Moon className="size-4" /> },
            ]}
          />
          <p className="mt-2 text-xs text-foreground-subtle">يُحفظ اختيارك في حسابك ويطبَّق على أجهزتك.</p>
        </div>
        <Row label="شكل الأرقام" hint={s.numerals === "latn" ? "1,250.50" : "١٬٢٥٠٫٥٠"}>
          <Select className="h-10 w-36 rounded-xl text-sm" value={s.numerals} onChange={(e) => updateSettings({ numerals: e.target.value as UserSettings["numerals"] })} aria-label="شكل الأرقام">
            <option value="latn">123</option>
            <option value="arab">١٢٣</option>
          </Select>
        </Row>
        <Row label="الوضع الافتراضي للمصروف الجديد">
          <Select className="h-10 w-36 rounded-xl text-sm" value={s.default_visibility} onChange={(e) => updateSettings({ default_visibility: e.target.value as UserSettings["default_visibility"] })} aria-label="الوضع الافتراضي">
            <option value="shared">مصروف البيت</option>
            <option value="private">خاص بي</option>
          </Select>
        </Row>
      </Section>

      <Section title="الإشعارات">
        <Row label="المصاريف المشتركة الجديدة" hint="عندما يضيف شريكك مصروفًا مشتركًا">
          <Switch checked={s.notify_shared_expenses} onCheckedChange={(v) => updateSettings({ notify_shared_expenses: v })} ariaLabel="المصاريف المشتركة" />
        </Row>
        <Row label="تذكير الفواتير والأقساط">
          <Switch checked={s.notify_bills} onCheckedChange={(v) => updateSettings({ notify_bills: v })} ariaLabel="الفواتير" />
        </Row>
        <Row label="تنبيهات الميزانية" hint="عند ٨٠٪ وعند التجاوز">
          <Switch checked={s.notify_budget} onCheckedChange={(v) => updateSettings({ notify_budget: v })} ariaLabel="الميزانية" />
        </Row>
        <Row label="التذكير قبل الاستحقاق بـ">
          <Select className="h-10 w-28 rounded-xl text-sm" value={s.bill_reminder_days} onChange={(e) => updateSettings({ bill_reminder_days: Number(e.target.value) })} aria-label="أيام التذكير">
            {[0, 1, 2, 3, 5, 7].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "يوم الموعد" : n === 1 ? "يوم" : n === 2 ? "يومين" : `${n} أيام`}
              </option>
            ))}
          </Select>
        </Row>
        <p className="px-4 pb-3 text-xs leading-relaxed text-foreground-subtle">الإشعارات تظهر داخل التطبيق عند فتحه. لا نرسل إشعارات خارجية في هذا الإصدار.</p>
      </Section>

      <Section title="تثبيت التطبيق على iPhone">
        <div className="space-y-2 p-4 text-sm leading-relaxed text-foreground-muted">
          <p className="flex items-center gap-2">
            ١. افتح الموقع في Safari ثم اضغط زر المشاركة <Share className="size-4 text-info" />
          </p>
          <p className="flex items-center gap-2">
            ٢. اختر «إضافة إلى الشاشة الرئيسية» <SquarePlus className="size-4" />
          </p>
          <p>٣. افتح «بيتنا» من الشاشة الرئيسية ليعمل كتطبيق بملء الشاشة.</p>
        </div>
      </Section>

      <Button
        variant="danger-soft"
        size="lg"
        block
        className="mt-6"
        onClick={async () => {
          await getSupabase().auth.signOut();
          qc.clear();
          router.replace("/login");
        }}
      >
        <LogOut className="size-5" /> تسجيل الخروج
      </Button>
      <p className="mt-6 text-center text-xs text-foreground-subtle">بيتنا · الإصدار ١٫٠</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-2 text-sm font-semibold text-foreground-muted">{title}</h2>
      <ListGroup>{children}</ListGroup>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{label}</p>
        {hint ? <p className="text-xs text-foreground-subtle">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
