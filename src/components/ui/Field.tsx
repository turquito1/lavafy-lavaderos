import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";

const fieldBase =
  "w-full rounded-[10px] border border-line bg-white px-4 text-ink placeholder:text-muted transition-all " +
  "focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15 disabled:bg-slate-50 disabled:text-muted aria-invalid:border-red-400";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-12 md:h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 resize-none py-3", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(fieldBase, "h-12 w-full appearance-none pr-10 md:h-11")} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}

export function Label({ className, children, ...rest }: ComponentProps<"label">) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-ink-soft", className)} {...rest}>
      {children}
    </label>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: { label?: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
