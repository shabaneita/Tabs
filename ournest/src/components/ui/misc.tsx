import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} aria-hidden />;
}

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    muted: "bg-muted text-foreground-muted",
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-sage text-primary [&_svg]:size-7">{icon}</div>
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-foreground-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const AVATAR_COLORS: Record<string, string> = {
  emerald: "bg-[var(--cat-emerald-soft)] text-[var(--cat-emerald)]",
  sage: "bg-[var(--cat-sage-soft)] text-[var(--cat-sage)]",
  sand: "bg-[var(--cat-sand-soft)] text-[var(--cat-sand)]",
  rose: "bg-[var(--cat-rose-soft)] text-[var(--cat-rose)]",
  sky: "bg-[var(--cat-sky-soft)] text-[var(--cat-sky)]",
  violet: "bg-[var(--cat-violet-soft)] text-[var(--cat-violet)]",
};

export function Avatar({ name, color = "emerald", size = 40, className }: { name: string; color?: string; size?: number; className?: string }) {
  const initial = (name.trim()[0] ?? "؟").toUpperCase();
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-card", AVATAR_COLORS[color] ?? AVATAR_COLORS.emerald, className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function ListGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("surface-card divide-y divide-border overflow-hidden rounded-3xl", className)}>{children}</div>;
}
