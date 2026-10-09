import { Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <div className="pt-10">
        <Wordmark />
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">{children}</div>
      <p className="pb-6 text-center text-xs text-foreground-subtle">بياناتكم محمية بقواعد صلاحيات على مستوى قاعدة البيانات.</p>
    </main>
  );
}
