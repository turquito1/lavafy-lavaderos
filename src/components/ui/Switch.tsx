"use client";

import { cn } from "@/lib/format";

export function Switch({ checked, onChange, name, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; name?: string; disabled?: boolean; label?: string }) {
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-primary" : "bg-slate-300",
        )}
      >
        <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </button>
      {name && <input type="hidden" name={name} value={checked ? "true" : "false"} />}
    </>
  );
}
