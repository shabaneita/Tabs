import { Wordmark } from "@/components/brand";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSupabaseConfigured) redirect("/");
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
      <Wordmark />
      <div className="mt-10 space-y-4">
        <h1 className="text-2xl font-bold">التطبيق يحتاج إعدادًا</h1>
        <p className="leading-relaxed text-foreground-muted">
          لم يتم ربط التطبيق بقاعدة البيانات بعد. أضف المتغيرات التالية في إعدادات الاستضافة (أو في ملف <span className="ltr-isolate">.env.local</span>) ثم أعد التشغيل:
        </p>
        <pre dir="ltr" className="overflow-x-auto rounded-2xl bg-muted p-4 text-left text-[13px] leading-relaxed">
          {"NEXT_PUBLIC_SUPABASE_URL=...\nNEXT_PUBLIC_SUPABASE_ANON_KEY=..."}
        </pre>
        <p className="text-sm text-foreground-subtle">التفاصيل الكاملة في ملف README (قسم النشر على Vercel وSupabase).</p>
      </div>
    </main>
  );
}
