"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Home, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand";
import { Splash } from "@/components/app/splash";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useMeQuery, qk } from "@/lib/data/hooks";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

type Preview = { household_name: string; inviter_name: string; email_hint: string; status: string };

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMeQuery();
  const [busy, setBusy] = useState(false);
  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_invitation", { p_token: token });
      if (error) throw error;
      return ((data as Preview[]) ?? [])[0] ?? null;
    },
  });

  if (preview.isLoading || meLoading) return <Splash />;
  const p = preview.data;
  const next = `/invite/${token}`;

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="pt-8">
        <Wordmark />
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        {!p || p.status !== "pending" ? (
          <EmptyState
            icon={<TriangleAlert />}
            title={!p ? "الدعوة غير موجودة" : p.status === "expired" ? "انتهت صلاحية الدعوة" : "الدعوة لم تعد صالحة"}
            description="اطلب من شريكك إرسال دعوة جديدة من صفحة «إدارة البيت»."
            action={
              <Link href="/" className={buttonVariants({ variant: "secondary" })}>
                الصفحة الرئيسية
              </Link>
            }
          />
        ) : (
          <div className="space-y-6 text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-[28px] bg-primary-soft text-primary">
              <HeartHandshake className="size-10" />
            </span>
            <div>
              <h1 className="text-[26px] font-bold leading-snug">
                {p.inviter_name || "شريكك"} يدعوك إلى «{p.household_name}»
              </h1>
              <p className="mt-2 text-foreground-muted">
                الدعوة مرسلة إلى <span className="ltr-isolate font-medium">{p.email_hint}</span>
              </p>
            </div>
            <div className="surface-card rounded-3xl p-4 text-start text-sm leading-relaxed text-foreground-muted">
              <p className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                <Home className="size-4 text-primary" /> ماذا يعني الانضمام؟
              </p>
              ستشاركان ميزانية البيت والمصاريف والفواتير المشتركة بصلاحيات متساوية. أي شيء تسجله كـ«خاص» — دخلك، مصاريفك الخاصة، أهدافك — يبقى لك وحدك.
            </div>
            {me ? (
              <>
                <Button
                  size="lg"
                  block
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { error } = await getSupabase().rpc("accept_invitation", { p_token: token });
                    setBusy(false);
                    if (error) return toast.error(arabicError(error));
                    await qc.invalidateQueries({ queryKey: qk.me });
                    toast.success("أهلًا بك في البيت 🏡");
                    router.replace("/");
                  }}
                >
                  قبول الدعوة
                </Button>
                <p className="text-xs text-foreground-subtle">
                  مسجل الدخول كـ <span className="ltr-isolate">{me.user.email}</span>
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <Link href={`/signup?next=${encodeURIComponent(next)}`} className={buttonVariants({ size: "lg", block: true })}>
                  إنشاء حساب والانضمام
                </Link>
                <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonVariants({ size: "lg", block: true, variant: "secondary" })}>
                  لدي حساب بالفعل
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
