import type { BookingStatus } from "@/db/schema";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/format";

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", className)} style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}
