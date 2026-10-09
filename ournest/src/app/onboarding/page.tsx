"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Home, KeyRound, Lock, ShieldCheck, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand";
import { InviteShare } from "@/components/invite-share";
import { LoadError } from "@/components/app/load-error";
import { Splash } from "@/components/app/splash";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useMeQuery, qk } from "@/lib/data/hooks";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

type Step = "welcome" | "create" | "join" | "invite";

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, isLoading, isError, error } = useMeQuery();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("بيتنا");
  const [email, setEmail] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoading || isError) return;
    if (!me) router.replace("/login");
    else if (me.household && step === "welcome") router.replace("/");
  }, [me, isLoading, isError, router, step]);

  if (isError) return <LoadError error={error} />;
  if (isLoading || !me) return <Splash />;

  async function createHousehold() {
    setBusy(true);
    const { error } = await getSupabase().rpc("create_household", { p_name: name.trim() || "بيتنا" });
    setBusy(false);
    if (error) return toast.error(arabicError(error));
    await qc.invalidateQueries({ queryKey: qk.me });
    setStep("invite");
  }

  async function invite() {
    setBusy(true);
    const { data, error } = await getSupabase().rpc("create_invitation", { p_email: email.trim() });
    setBusy(false);
    if (error) return toast.error(arabicError(error));
    setLink(`${window.location.origin}/invite/${data as string}`);
  }

  function join() {
    const m = inviteInput.trim().match(/([0-9a-f]{48})/i);
    if (!m) return toast.error("الصق رابط الدعوة كما وصلك.");
    router.push(`/invite/${m[1].toLowerCase()}`);
  }

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <div className="pt-8">
        <Wordmark />
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}>
            {step === "welcome" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-[28px] font-bold leading-tight">أهلًا {me.profile.display_name} 👋</h1>
                  <p className="mt-2 leading-relaxed text-foreground-muted">خلّينا نجهّز بيتكم. كل واحد منكما له حساب خاص، والبيت مساحة مشتركة بينكما.</p>
                </div>
                <ChoiceCard icon={<Home />} title="إنشاء بيت جديد" description="ابدأ البيت وادعُ شريكك بعدها." onClick={() => setStep("create")} />
                <ChoiceCard icon={<KeyRound />} title="عندي دعوة من شريكي" description="انضم للبيت الذي أنشأه شريكك." onClick={() => setStep("join")} />
                <PrivacyNote />
              </div>
            ) : null}

            {step === "create" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-[28px] font-bold">اسم البيت</h1>
                  <p className="mt-2 text-foreground-muted">سنجهّز لكم ميزانية شهرية مبدئية بقيمة ١٤٬٠٠٠ د.إ موزعة على ١١ تصنيفًا — كلها قابلة للتعديل.</p>
                </div>
                <Field label="اسم البيت" htmlFor="hname">
                  <Input id="hname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Button size="lg" block loading={busy} onClick={createHousehold}>
                  إنشاء البيت
                </Button>
                <BackLink onClick={() => setStep("welcome")} />
              </div>
            ) : null}

            {step === "join" ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-[28px] font-bold">الانضمام لبيت شريكك</h1>
                  <p className="mt-2 text-foreground-muted">افتح رابط الدعوة الذي أرسله لك شريكك، أو الصقه هنا.</p>
                </div>
                <Field label="رابط الدعوة" htmlFor="invite">
                  <Input id="invite" dir="ltr" className="text-left" value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="https://…/invite/…" />
                </Field>
                <Button size="lg" block onClick={join}>
                  متابعة
                </Button>
                <p className="text-sm text-foreground-muted">
                  يجب أن تكون مسجلًا بنفس البريد المدعو: <span className="ltr-isolate font-medium">{me.user.email}</span>
                </p>
                <BackLink onClick={() => setStep("welcome")} />
              </div>
            ) : null}

            {step === "invite" ? (
              <div className="space-y-6">
                <div>
                  <span className="mb-4 grid size-14 place-items-center rounded-3xl bg-primary-soft text-primary">
                    <Users className="size-7" />
                  </span>
                  <h1 className="text-[28px] font-bold">ادعُ شريك حياتك</h1>
                  <p className="mt-2 leading-relaxed text-foreground-muted">لكما صلاحيات متساوية على مالية البيت. ما تسجله كـ«خاص» يبقى لك وحدك.</p>
                </div>
                {link ? (
                  <InviteShare link={link} partnerHint={email.trim().toLowerCase()} />
                ) : (
                  <>
                    <Field label="بريد شريكك الإلكتروني" htmlFor="pemail">
                      <Input id="pemail" type="email" inputMode="email" dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                    <Button size="lg" block loading={busy} onClick={invite} disabled={!email.includes("@")}>
                      إنشاء رابط الدعوة
                    </Button>
                  </>
                )}
                <Button variant={link ? "primary" : "ghost"} size="lg" block onClick={() => router.replace("/")}>
                  {link ? "الذهاب للرئيسية" : "لاحقًا"}
                </Button>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function ChoiceCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="pressable surface-card flex w-full items-center gap-4 rounded-3xl p-4 text-start">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sage text-primary [&_svg]:size-6">{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-foreground-muted">{description}</span>
      </span>
      <ArrowLeft className="size-5 text-foreground-subtle" />
    </button>
  );
}

function PrivacyNote() {
  return (
    <div className="flex gap-3 rounded-3xl bg-sage p-4 text-sm leading-relaxed">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
      <p>
        <span className="font-semibold">خصوصيتك محفوظة:</span> دخلك ومصاريفك الخاصة وأهدافك الخاصة <Lock className="inline size-3.5" /> لا يمكن لأحد غيرك رؤيتها — الحماية مطبقة في قاعدة البيانات نفسها وليس فقط في الواجهة.
      </p>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full text-center text-sm text-foreground-muted">
      رجوع
    </button>
  );
}
