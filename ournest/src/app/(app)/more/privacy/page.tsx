import { Database, Eye, EyeOff, Lock, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "الخصوصية والأمان" };

const SHARED = ["ميزانية البيت وتصنيفاتها", "المصاريف المسجلة كـ«مصروف البيت»", "الفواتير والأقساط والأهداف المشتركة", "مساهمة كل منكما المعلنة في البيت", "نشاط البيت وتحليلاته"];
const PRIVATE = ["دخلك ومصادره", "مصاريفك الخاصة وإيصالاتها", "حساباتك وتصنيفاتك الخاصة", "أهداف الادخار الخاصة", "ملاحظاتك المالية وإعداداتك وإشعاراتك"];

export default function PrivacyPage() {
  return (
    <div>
      <PageHeader title="الخصوصية والأمان" back="/more" />
      <div className="space-y-4">
        <Block icon={<Users />} title="ما يراه شريكك" items={SHARED} tone="primary" iconAlt={<Eye className="size-4" />} />
        <Block icon={<Lock />} title="ما يبقى لك وحدك" items={PRIVATE} tone="muted" iconAlt={<EyeOff className="size-4" />} />
        <div className="surface-card space-y-3 rounded-3xl p-5 text-sm leading-relaxed text-foreground-muted">
          <p className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Database className="size-5 text-primary" /> كيف نحمي ذلك؟
          </p>
          <p>الحماية مطبقة داخل قاعدة البيانات نفسها (Row Level Security)، وليس فقط بإخفاء الأزرار. حتى لو حاول أحد الاستعلام مباشرة، لن تعود بياناتك الخاصة إلا لك.</p>
          <p>ميزانية البيت تخصيص تحددانه بأنفسكما، ولا تُحسب من دخل أي منكما. المصاريف الخاصة لا تدخل في أي مجموع أو تحليل أو توصية مشتركة.</p>
          <p>عند تحويل سجل مشترك إلى خاص، تُحذف آثاره من نشاط البيت وإشعارات شريكك. فقط صاحب السجل يمكنه تغيير خصوصيته.</p>
          <p>الإيصالات محفوظة في مخزن خاص، وتُعرض عبر روابط مؤقتة لمن يملك صلاحية رؤية المصروف فقط.</p>
          <p>التصدير (CSV وPDF) يشمل فقط ما يحق لك رؤيته.</p>
        </div>
        <div className="flex gap-3 rounded-3xl bg-sage p-4 text-sm leading-relaxed">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>لا يتم حفظ بياناتك المالية على الجهاز لاستخدامها دون اتصال، ولا تُستخدم في أي إعلانات.</p>
        </div>
      </div>
    </div>
  );
}

function Block({ icon, title, items, tone, iconAlt }: { icon: React.ReactNode; title: string; items: string[]; tone: "primary" | "muted"; iconAlt: React.ReactNode }) {
  return (
    <div className="surface-card rounded-3xl p-5">
      <p className="mb-3 flex items-center gap-2 text-base font-semibold">
        <span className={`grid size-9 place-items-center rounded-xl [&_svg]:size-5 ${tone === "primary" ? "bg-primary-soft text-primary" : "bg-muted text-foreground-muted"}`}>{icon}</span>
        {title}
      </p>
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-2 text-foreground-muted">
            {iconAlt}
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
