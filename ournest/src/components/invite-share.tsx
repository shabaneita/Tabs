"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InviteShare({ link, partnerHint }: { link: string; partnerHint?: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-dashed border-border-strong bg-muted p-3">
        <p className="ltr-isolate break-all text-left text-[13px] text-foreground-muted" dir="ltr">
          {link}
        </p>
      </div>
      <div className="flex gap-2">
        {canShare ? (
          <Button
            block
            onClick={() =>
              navigator.share({ title: "دعوة إلى بيتنا", text: "انضم لبيتنا على تطبيق بيتنا لمتابعة مصاريف البيت معًا", url: link }).catch(() => {})
            }
          >
            <Share2 className="size-4" /> مشاركة الدعوة
          </Button>
        ) : null}
        <Button
          variant={canShare ? "secondary" : "primary"}
          block
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              toast.success("تم نسخ رابط الدعوة");
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error("تعذّر النسخ. انسخ الرابط يدويًا.");
            }
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} نسخ الرابط
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-foreground-subtle">
        الرابط صالح لمدة ٧ أيام ويعمل فقط مع البريد {partnerHint ? <span className="ltr-isolate">{partnerHint}</span> : "المدعو"}. لا تشاركه مع أي شخص آخر.
      </p>
    </div>
  );
}
