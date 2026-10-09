"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="pt-10">
        <Wordmark />
      </div>
      <form
        className="flex flex-1 flex-col justify-center space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) return setError("كلمة المرور يجب ألا تقل عن ٨ أحرف");
          setLoading(true);
          const { error } = await getSupabase().auth.updateUser({ password });
          setLoading(false);
          if (error) return setError(arabicError(error));
          toast.success("تم تحديث كلمة المرور");
          router.replace("/");
        }}
      >
        <div>
          <h1 className="text-[28px] font-bold">كلمة مرور جديدة</h1>
          <p className="mt-1 text-foreground-muted">اختر كلمة مرور قوية لا تقل عن ٨ أحرف.</p>
        </div>
        <Field label="كلمة المرور الجديدة" htmlFor="password" error={error ?? undefined}>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" block loading={loading}>
          حفظ كلمة المرور
        </Button>
      </form>
    </main>
  );
}
