import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base text-foreground placeholder:text-foreground-subtle outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(inputClass, "h-auto min-h-24 py-3 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(inputClass, "appearance-none bg-[length:16px] pe-4", className)} {...props} />;
});

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block px-1 text-sm font-medium text-foreground-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="px-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="px-1 text-xs text-foreground-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
