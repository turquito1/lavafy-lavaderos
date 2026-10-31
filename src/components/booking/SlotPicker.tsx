"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Moon, Sun, Sunrise } from "lucide-react";
import { bookableDates, getOpenIntervals, type DateException, type Slot, type WeeklyHour } from "@/lib/availability";
import { dateStrParts, utcToZoned } from "@/lib/time";
import { cn } from "@/lib/format";
import { Skeleton } from "@/components/ui/Spinner";
import type { VehicleType } from "@/db/schema";

export type SlotValue = { date: string; startsAt: string; time: string } | null;

type Props = {
  slug: string;
  serviceId: string;
  vehicleType: VehicleType;
  timezone: string;
  maxDaysAhead: number;
  weekly: WeeklyHour[];
  exceptions: DateException[];
  date: string | null;
  onDateChange: (date: string) => void;
  value: SlotValue;
  onChange: (slot: SlotValue) => void;
  excludeBookingId?: string;
  /** Cambia para forzar recarga de horarios (ej. después de un "horario ocupado"). */
  reloadKey?: number;
};

export function SlotPicker(props: Props) {
  const { slug, serviceId, vehicleType, timezone, maxDaysAhead, weekly, exceptions, date, onDateChange, value, onChange, excludeBookingId, reloadKey } = props;

  const days = useMemo(() => {
    const now = utcToZoned(new Date(), timezone);
    return bookableDates(timezone, maxDaysAhead).map((d) => {
      const intervals = getOpenIntervals(d, weekly, exceptions);
      // Hoy: solo cuenta como abierto si todavía no cerró.
      const open = d === now.dateStr ? intervals.some((i) => i.end > now.minute) : intervals.length > 0;
      return { date: d, open, ...dateStrParts(d) };
    });
  }, [timezone, maxDaysAhead, weekly, exceptions]);

  // Fecha inicial: la elegida o el primer día abierto.
  const selectedDate = date ?? days.find((d) => d.open)?.date ?? days[0]?.date;
  useEffect(() => {
    if (!date && selectedDate) onDateChange(selectedDate);
  }, [date, selectedDate, onDateChange]);

  const [state, setState] = useState<{ key: string; slots: Slot[] | null; error: boolean }>({ key: "", slots: null, error: false });
  const requestKey = `${serviceId}|${vehicleType}|${selectedDate}|${reloadKey ?? 0}`;

  useEffect(() => {
    if (!selectedDate) return;
    const controller = new AbortController();
    const qs = new URLSearchParams({ slug, service: serviceId, vehicle: vehicleType, date: selectedDate });
    if (excludeBookingId) qs.set("exclude", excludeBookingId);
    fetch(`/api/slots?${qs}`, { signal: controller.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { slots: Slot[] }) => setState({ key: requestKey, slots: json.slots, error: false }))
      .catch((err) => {
        if (err?.name !== "AbortError") setState({ key: requestKey, slots: [], error: true });
      });
    return () => controller.abort();
  }, [slug, serviceId, vehicleType, selectedDate, excludeBookingId, requestKey]);

  const loading = state.key !== requestKey;
  const slots = loading ? null : state.slots;

  const groups = useMemo(() => {
    if (!slots) return [];
    return [
      { label: "Mañana", icon: Sunrise, items: slots.filter((s) => s.minute < 12 * 60) },
      { label: "Tarde", icon: Sun, items: slots.filter((s) => s.minute >= 12 * 60 && s.minute < 19 * 60) },
      { label: "Noche", icon: Moon, items: slots.filter((s) => s.minute >= 19 * 60) },
    ].filter((g) => g.items.length > 0);
  }, [slots]);

  const selectedIndex = days.findIndex((d) => d.date === selectedDate);
  const nextOpen = days.slice(selectedIndex + 1).find((d) => d.open);

  return (
    <div>
      <DateStrip days={days} selected={selectedDate} onSelect={(d) => { onDateChange(d); if (value?.date !== d) onChange(null); }} />

      <div className="mt-5 min-h-40">
        {loading ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : state.error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">No pudimos cargar los horarios. Revisá tu conexión y probá de nuevo.</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-8 text-center">
            <CalendarX2 className="mb-2 size-7 text-muted" />
            <p className="font-semibold text-ink">{days[selectedIndex]?.open ? "No quedan horarios este día" : "Ese día está cerrado"}</p>
            {nextOpen && (
              <button onClick={() => onDateChange(nextOpen.date)} className="mt-3 text-sm font-semibold text-primary hover:underline">
                Ver el {nextOpen.long} →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                  <g.icon className="size-3.5" /> {g.label}
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {g.items.map((s) => {
                    const selected = value?.startsAt === s.startsAt;
                    return (
                      <button
                        key={s.startsAt}
                        type="button"
                        onClick={() => onChange({ date: selectedDate!, startsAt: s.startsAt, time: s.time })}
                        aria-pressed={selected}
                        className={cn(
                          "relative h-12 rounded-xl border-2 font-display text-[15px] font-bold transition-all active:scale-95",
                          selected
                            ? "border-primary bg-primary text-white shadow-primary"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400",
                        )}
                      >
                        {s.time}
                        {s.remaining === 1 && !selected && (
                          <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-400 px-1.5 text-[9px] leading-4 font-bold text-amber-950">último</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DateStrip({
  days,
  selected,
  onSelect,
}: {
  days: { date: string; open: boolean; weekdayShort: string; day: number; monthShort: string }[];
  selected: string | undefined;
  onSelect: (d: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selected]);

  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  return (
    <div className="relative">
      <button type="button" onClick={() => scrollBy(-1)} className="absolute top-1/2 -left-2 z-10 hidden -translate-y-1/2 rounded-full border border-line bg-white p-1.5 shadow-soft md:block" aria-label="Días anteriores">
        <ChevronLeft className="size-4" />
      </button>
      <div ref={scroller} className="scrollbar-none -mx-5 flex snap-x gap-2 overflow-x-auto px-5 py-1 md:mx-4 md:px-0">
        {days.map((d, i) => {
          const isSelected = d.date === selected;
          const showMonth = i === 0 || d.day === 1;
          return (
            <button
              key={d.date}
              data-date={d.date}
              type="button"
              disabled={!d.open}
              onClick={() => onSelect(d.date)}
              aria-pressed={isSelected}
              className={cn(
                "flex w-[58px] shrink-0 snap-start flex-col items-center rounded-2xl border-2 py-2 transition-all",
                isSelected ? "border-primary bg-primary text-white shadow-primary" : "border-line bg-white text-ink hover:border-primary-border",
                !d.open && "cursor-not-allowed border-transparent bg-slate-50 text-muted opacity-60 hover:border-transparent",
              )}
            >
              <span className={cn("text-[11px] font-medium capitalize", isSelected ? "text-blue-100" : "text-muted")}>{i === 0 ? "Hoy" : i === 1 ? "Mañana" : d.weekdayShort}</span>
              <span className="font-display text-lg leading-tight font-bold">{d.day}</span>
              <span className={cn("text-[10px] capitalize", isSelected ? "text-blue-100" : "text-muted", !showMonth && "invisible")}>{d.monthShort}</span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => scrollBy(1)} className="absolute top-1/2 -right-2 z-10 hidden -translate-y-1/2 rounded-full border border-line bg-white p-1.5 shadow-soft md:block" aria-label="Días siguientes">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
