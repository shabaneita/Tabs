"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Native-feeling bottom sheet (drag to dismiss, iOS easing, safe areas).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={dismissible} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50" />
        <Drawer.Content
          dir="rtl"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] border border-b-0 border-border bg-card shadow-sheet outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" aria-hidden />
          <div className="shrink-0 px-5 pb-2 pt-3">
            <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-0.5 text-sm text-foreground-muted">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{typeof title === "string" ? title : ""}</Drawer.Description>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-border bg-card px-5 pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
              {footer}
            </div>
          ) : (
            <div className="shrink-0" style={{ height: "var(--safe-bottom)" }} />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
