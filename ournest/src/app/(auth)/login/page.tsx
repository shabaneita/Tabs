"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { arabicError } from "@/lib/errors";
import { safeNext } from "@/lib/nav";
import { getSupabase } from "@/lib/supabase/client";
import { signInSchema } from "@/lib/validation";
import type { z } from "zod";

type Values = z.infer<typeof signInSchema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(signInSchema), mode: "onTouched" });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) return setError(arabicError(error));
    qc.clear();
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-[28px] font-bold">أهلًا بعودتك</h1>
        <p className="mt-1 text-foreground-muted">سجّل الدخول لمتابعة مالية بيتكم.</p>
      </div>
      <Field label="البريد الإلكتروني" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" dir="ltr" className="text-left" aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field label="كلمة المرور" htmlFor="password" error={formState.errors.password?.message}>
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      {error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" block loading={formState.isSubmitting}>
        تسجيل الدخول
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-foreground-muted">
          نسيت كلمة المرور؟
        </Link>
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary">
          إنشاء حساب جديد
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
