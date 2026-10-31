"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Footprints, Hourglass } from "lucide-react";
import type { BookingDTO } from "@/lib/booking-dto";
import type { CatalogService } from "@/server/queries";
import type { MinuteInterval } from "@/lib/availability";
import { peakOverlap } from "@/lib/availability";
import { addDaysStr, dateStrParts, minuteToHHMM, zonedToUtc } from "@/lib/time";
import { cn, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { BookingList, NewBookingSheet, type PanelBusiness } from "./BookingUI";

type Props = {
  business: PanelBusiness;
  date: string;
  today: string;
  bookings: BookingDTO[];
  services: CatalogService[];
  open: MinuteInterval[];
  pendingOtherDays: number;
};

export function AgendaView({ business, date, today, bookings, services, open, pendingOtherDays }: Props) {
  const router = useRouter();
  const [navigating, startNav] = useTransition();
  const [sheet, setSheet] = useState<null | "manual" | "walk_in">(null);

  const go = (d: string) => startNav(() => router.push(`/panel/agenda?fecha=${d}`));
  const parts = dateStrParts(date);
  const isToday = date === today;

  const live = bookings.filter((b) => ["in_progress", "ready"].includes(b.status));
  const upcoming = bookings.filter((b) => ["pending", "confirmed"].includes(b.status));
  const done = bookings.filter((b) => ["completed", "cancelled", "no_show"].includes(b.status));
  const counted = bookings.filter((b) => !["cancelled", "no_show"].includes(b.status));
  const revenue = counted.reduce((s, b) => s + b.price, 0);
  const pendingToday = bookings.filter((b) => b.status === "pending").length;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      {/* Encabezado */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => go(addDaysStr(date, -1))} className="rounded-xl border border-line bg-white p-2.5 text-ink-soft hover:bg-slate-50" aria-label="Día anterior">
            <ChevronLeft className="size-5" />
          </button>
          <label className="relative cursor-pointer">
            <div className="min-w-44 rounded-xl px-2 text-center">
              <p className="text-xs font-semibold text-primary">{isToday ? "HOY" : date === addDaysStr(today, 1) ? "MAÑANA" : parts.weekdayShort.toUpperCase()}</p>
              <p className="flex items-center justify-center gap-1.5 font-display text-xl font-bold text-ink">
                {parts.long.replace(/^\S+\s/, "")}
                {navigating ? <Spinner className="size-4 text-muted" /> : <CalendarDays className="size-4 text-muted" />}
              </p>
            </div>
            <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Elegir fecha" />
          </label>
          <button onClick={() => go(addDaysStr(date, 1))} className="rounded-xl border border-line bg-white p-2.5 text-ink-soft hover:bg-slate-50" aria-label="Día siguiente">
            <ChevronRight className="size-5" />
          </button>
          {!isToday && (
            <Button size="sm" variant="ghost" onClick={() => go(today)}>
              Hoy
            </Button>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button variant="secondary" icon={<Footprints className="size-4" />} onClick={() => setSheet("walk_in")}>
            Llegó sin turno
          </Button>
          <Button icon={<CalendarPlus className="size-4" />} onClick={() => setSheet("manual")}>
            Agendar
          </Button>
        </div>
      </div>

      {pendingOtherDays > 0 && (
        <Link href="/panel/turnos?tab=pendientes" className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100">
          <Hourglass className="size-4 shrink-0" />
          <span className="flex-1">
            Tenés <strong>{pendingOtherDays}</strong> turno{pendingOtherDays > 1 ? "s" : ""} por aprobar en otros días.
          </span>
          <ChevronRight className="size-4" />
        </Link>
      )}

      {/* Resumen */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Turnos" value={String(counted.length)} />
        <Stat label="En el lavadero" value={String(live.length)} accent={live.length > 0} />
        <Stat label="Por aprobar" value={String(pendingToday)} warn={pendingToday > 0} />
        <Stat label="Estimado del día" value={formatMoney(revenue)} />
      </div>

      <Occupancy date={date} business={business} open={open} bookings={bookings} />

      {bookings.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title={open.length ? "No hay turnos para este día" : "Este día está cerrado"}
            description={open.length ? "Cuando alguien reserve online o cargues un turno, aparece acá." : "Podés cambiar los horarios en la sección Horarios."}
            action={<Button variant="soft" onClick={() => setSheet("manual")}>Agendar un turno</Button>}
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {live.length > 0 && <Group title="En el lavadero" hint="Recibidos o listos para retirar" bookings={live} business={business} />}
          <Group title="Próximos" bookings={upcoming} business={business} empty="No quedan turnos por llegar." />
          {done.length > 0 && <Group title="Finalizados y cancelados" bookings={done} business={business} />}
        </div>
      )}

      <NewBookingSheet open={sheet !== null} walkIn={sheet === "walk_in"} onClose={() => setSheet(null)} business={business} services={services} defaultDate={date} />
    </div>
  );
}

function Group({ title, hint, bookings, business, empty }: { title: string; hint?: string; bookings: BookingDTO[]; business: PanelBusiness; empty?: string }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-bold tracking-wide text-ink-soft uppercase">{title}</h2>
        <span className="text-xs text-muted">{bookings.length}</span>
        {hint && <span className="hidden text-xs text-muted sm:inline">· {hint}</span>}
      </div>
      <BookingList bookings={bookings} business={business} empty={<p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{empty}</p>} />
    </section>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-white px-4 py-3 shadow-soft", warn ? "border-amber-200 bg-amber-50" : accent ? "border-cyan-200 bg-cyan-50" : "border-line")}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 truncate font-display text-xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

/** Barra de ocupación del día: cuántos autos hay en cada franja vs. la capacidad. */
function Occupancy({ date, business, open, bookings }: { date: string; business: PanelBusiness; open: MinuteInterval[]; bookings: BookingDTO[] }) {
  const step = Math.max(15, business.slotIntervalMinutes);
  const cells = useMemo(() => {
    const busy = bookings.filter((b) => !["cancelled", "no_show"].includes(b.status)).map((b) => ({ startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt) }));
    const out: { minute: number; count: number; gap: boolean }[] = [];
    for (const [wi, w] of open.entries()) {
      for (let m = w.start; m < w.end; m += step) {
        const from = zonedToUtc(date, m, business.timezone);
        const to = zonedToUtc(date, Math.min(m + step, w.end), business.timezone);
        out.push({ minute: m, count: peakOverlap(busy, from, to), gap: wi > 0 && m === w.start });
      }
    }
    return out;
  }, [bookings, open, date, business.timezone, step]);

  if (cells.length === 0) return null;
  const cap = business.capacity;

  return (
    <Card className="px-4 pt-3 pb-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-soft">Ocupación · capacidad {cap} auto{cap > 1 ? "s" : ""}</p>
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <Legend className="bg-emerald-400" label="Libre" />
          <Legend className="bg-amber-400" label="Casi lleno" />
          <Legend className="bg-red-500" label="Lleno" />
        </div>
      </div>
      <div className="scrollbar-none flex items-end gap-[3px] overflow-x-auto pb-1">
        {cells.map((c, i) => {
          const ratio = Math.min(1, c.count / cap);
          const color = c.count >= cap ? "bg-red-500" : cap >= 3 && cap - c.count === 1 ? "bg-amber-400" : c.count > 0 ? "bg-emerald-400" : "bg-slate-200";
          const showLabel = c.minute % 60 === 0;
          return (
            <div key={i} className={cn("flex min-w-[14px] flex-1 flex-col items-center", c.gap && "ml-3")} title={`${minuteToHHMM(c.minute)} · ${c.count}/${cap}`}>
              <div className="flex h-10 w-full items-end overflow-hidden rounded-[4px] bg-slate-100">
                <div className={cn("w-full rounded-[4px] transition-all", color)} style={{ height: `${Math.max(12, ratio * 100)}%` }} />
              </div>
              <span className={cn("mt-1 text-[9px] text-muted", !showLabel && "invisible")}>{minuteToHHMM(c.minute).slice(0, 2)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="hidden items-center gap-1 sm:flex">
      <span className={cn("size-2 rounded-sm", className)} /> {label}
    </span>
  );
}
