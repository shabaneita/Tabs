import { WifiOff } from "lucide-react";
import { NestMark } from "@/components/brand";

export const metadata = { title: "غير متصل" };

export default function OfflinePage() {
  return (
    <main className="pt-safe grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-xs">
        <div className="mx-auto mb-6 w-fit">
          <NestMark size={56} />
        </div>
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-3xl bg-warning-soft text-warning">
          <WifiOff className="size-7" />
        </span>
        <h1 className="text-xl font-bold">لا يوجد اتصال بالإنترنت</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
          بيتنا يحتاج اتصالًا لعرض أرقامكم وحفظ المصاريف بأمان. لا يتم حفظ أي بيانات مالية على الجهاز. أعد المحاولة عند عودة الاتصال.
        </p>
        <a href="/" className="mt-6 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground">
          إعادة المحاولة
        </a>
      </div>
    </main>
  );
}
