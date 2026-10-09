"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (sent) {
    return (
      <EmptyState
        icon={<MailCheck />}
        title="أرسلنا لك رابطًا"
        description="إذا كان البريد مسجلًا لدينا، ستصلك رسالة فيها رابط لتعيين كلمة مرور جديدة."
        action={
          <Link href="/login" className="font-semibold text-primary">
            العودة لتسجيل الدخول
          </Link>
        }
      />
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("البريد الإلكتروني غير صحيح");
        setLoading(true);
        const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset-password`,
        });
        setLoading(false);
        if (error) return setError(arabicError(error));
        setSent(true);
      }}
    >
      <div>
        <h1 className="text-[28px] font-bold">نسيت كلمة المرور؟</h1>
        <p className="mt-1 text-foreground-muted">أدخل بريدك وسنرسل لك رابط إعادة التعيين.</p>
      </div>
      <Field label="البريد الإلكتروني" htmlFor="email" error={error ?? undefined}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" block loading={loading}>
        إرسال الرابط
      </Button>
      <Link href="/login" className="block text-center text-sm text-foreground-muted">
        العودة لتسجيل الدخول
      </Link>
    </form>
  );
}
