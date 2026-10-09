"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { arabicError } from "@/lib/errors";
import { safeNext } from "@/lib/nav";
import { getSupabase } from "@/lib/supabase/client";
import { signUpSchema } from "@/lib/validation";
import type { z } from "zod";

type Values = z.infer<typeof signUpSchema>;

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(signUpSchema), mode: "onTouched" });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { data, error } = await getSupabase().auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { display_name: v.displayName },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next === "/" ? "/onboarding" : next)}`,
      },
    });
    if (error) return setError(arabicError(error));
    if (data.session) {
      qc.clear();
      router.replace(next === "/" ? "/onboarding" : next);
      router.refresh();
    } else {
      setSentTo(v.email);
    }
  });

  if (sentTo) {
    return (
      <EmptyState
        icon={<MailCheck />}
        title="تحقق من بريدك الإلكتروني"
        description={
          <>
            أرسلنا رابط تأكيد إلى <span className="ltr-isolate font-semibold">{sentTo}</span>. افتح الرابط لتفعيل حسابك ثم سجّل الدخول.
          </>
        }
        action={
          <Link href="/login" className="font-semibold text-primary">
            العودة لتسجيل الدخول
          </Link>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-[28px] font-bold">حساب جديد</h1>
        <p className="mt-1 text-foreground-muted">لكل زوج حساب منفصل، وبيت مشترك واحد.</p>
      </div>
      <Field label="اسمك" htmlFor="displayName" error={formState.errors.displayName?.message}>
        <Input id="displayName" autoComplete="given-name" aria-invalid={!!formState.errors.displayName} {...register("displayName")} />
      </Field>
      <Field label="البريد الإلكتروني" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" className="text-left" aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field label="كلمة المرور" htmlFor="password" hint="٨ أحرف على الأقل" error={formState.errors.password?.message}>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      {error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" block loading={formState.isSubmitting}>
        إنشاء الحساب
      </Button>
      <p className="text-center text-sm text-foreground-muted">
        لديك حساب؟{" "}
        <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary">
          تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
