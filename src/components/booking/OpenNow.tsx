"use client";

import { useSyncExternalStore } from "react";
import { getOpenIntervals, type DateException, type WeeklyHour } from "@/lib/availability";
import { minuteToHHMM, utcToZoned } from "@/lib/time";
import { cn } from "@/lib/format";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
};

/** "Abierto ahora · cierra 20:00" — se calcula en el navegador (depende de la hora actual). */
export function OpenNow({ timezone, weekly, exceptions, className }: { timezone: string; weekly: WeeklyHour[]; exceptions: DateException[]; className?: string }) {
  const minuteKey = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 60_000), () => null);
  if (minuteKey === null) return null;
  const { dateStr, minute } = utcToZoned(new Date(minuteKey * 60_000), timezone);
  const today = getOpenIntervals(dateStr, weekly, exceptions);
  const current = today.find((i) => minute >= i.start && minute < i.end);
  const next = today.find((i) => i.start > minute);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", current ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-soft", className)}>
      <span className={cn("size-1.5 rounded-full", current ? "animate-pulse bg-emerald-500" : "bg-slate-400")} />
      {current ? `Abierto · cierra ${minuteToHHMM(current.end)}` : next ? `Cerrado · abre ${minuteToHHMM(next.start)}` : "Cerrado ahora"}
    </span>
  );
}
