"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type Tone = "primary" | "warning" | "danger" | "info" | "muted" | "hero";

const strokeFor: Record<Tone, string> = {
  primary: "var(--primary)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  muted: "var(--foreground-subtle)",
  hero: "#9be8c6",
};

export function toneForPct(pct: number): Tone {
  if (pct > 100) return "danger";
  if (pct >= 80) return "warning";
  return "primary";
}

/** Animated circular progress. `value` is a percentage (may exceed 100). */
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  tone = "primary",
  track = "var(--muted)",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  track?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeFor[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
          // In RTL the ring fills counter-clockwise from the top for a natural reading direction.
          style={{ transformOrigin: "50% 50%", transform: "scaleY(-1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, tone, className, height = 8 }: { value: number; tone?: Tone; className?: string; height?: number }) {
  const reduce = useReducedMotion();
  const t = tone ?? toneForPct(value);
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: strokeFor[t], transformOrigin: "right" }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={reduce ? { duration: 0 } : { duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
      />
    </div>
  );
}
