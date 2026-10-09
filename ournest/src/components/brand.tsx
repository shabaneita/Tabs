/** Brand mark: a nest/home arc in emerald. */
export function NestMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="var(--primary)" />
      <path d="M17 33.5 32 21l15 12.5" fill="none" stroke="var(--primary-foreground)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 36.5c2.5 6.2 6.4 9.3 11 9.3s8.5-3.1 11-9.3" fill="none" stroke="var(--primary-foreground)" strokeWidth="4.5" strokeLinecap="round" opacity=".9" />
      <circle cx="32" cy="34.5" r="3.2" fill="var(--primary-foreground)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <NestMark size={36} />
      <div className="leading-tight">
        <p className="text-lg font-bold">بيتنا</p>
        <p className="text-xs text-foreground-muted">مالية البيت، بهدوء</p>
      </div>
    </div>
  );
}
