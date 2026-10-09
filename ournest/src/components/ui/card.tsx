import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card rounded-3xl", className)} {...props} />;
}

export function CardHeader({
  title,
  action,
  subtitle,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold leading-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 mt-7 flex items-center justify-between px-1", className)}>
      <h2 className="text-[17px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}
