"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, RotateCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { NestMark } from "../brand";
import { Button } from "../ui/button";
import { getSupabase } from "@/lib/supabase/client";

/** Explains why the account couldn't load and never leaves the user stuck. */
export function LoadError({ error }: { error: unknown }) {
  const qc = useQueryClient();
  const router = useRouter();
  const raw = error && typeof error === "object" ? (error as { code?: string; message?: string }) : {};
  const msg = raw.message ?? "";
  const schemaMissing = raw.code === "PGRST205" || raw.code === "42P01" || /does not exist|Could not find the (table|function)/i.test(msg);
  const profileMissing = raw.code === "PGRST116";

  return (
    <div className="pt-safe grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <NestMark size={56} />
        <span className="grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="text-lg font-bold">
          {schemaMissing ? "قاعدة البيانات لم تُجهَّز بعد" : profileMissing ? "حسابك يحتاج تهيئة" : "تعذّر تحميل البيانات"}
        </h1>
        <p className="text-sm leading-relaxed text-foreground-muted">
          {schemaMissing
            ? "يجب تشغيل ملف الإعداد supabase/setup.sql مرة واحدة في Supabase (SQL Editor) ثم إعادة المحاولة."
            : profileMissing
              ? "تم إنشاء الحساب قبل تجهيز قاعدة البيانات. شغّل ملف supabase/setup.sql (أو آخر ملف ترحيل) في Supabase ثم أعد المحاولة."
              : "تأكد من الاتصال ثم أعد المحاولة."}
        </p>
        {msg ? (
          <p dir="ltr" className="ltr-isolate max-w-full break-words rounded-xl bg-muted px-3 py-2 text-left text-[11px] text-foreground-subtle">
            {raw.code ? `${raw.code}: ` : ""}
            {msg.slice(0, 160)}
          </p>
        ) : null}
        <div className="mt-2 flex w-full gap-2">
          <Button block onClick={() => qc.invalidateQueries()}>
            <RotateCw className="size-4" /> إعادة المحاولة
          </Button>
          <Button
            variant="secondary"
            block
            onClick={async () => {
              await getSupabase().auth.signOut();
              qc.clear();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4" /> تسجيل الخروج
          </Button>
        </div>
      </div>
    </div>
  );
}
