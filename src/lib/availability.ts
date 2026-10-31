/**
 * Motor de disponibilidad. Funciones puras (sin base de datos) para que sean fáciles de testear.
 *
 * Modelo: el lavadero tiene una CAPACIDAD (autos en simultáneo). Un horario está disponible si,
 * durante toda la duración del servicio, la cantidad de turnos activos superpuestos nunca llega
 * a la capacidad. El servicio tiene que terminar antes del cierre del tramo.
 */
import { addDaysStr, todayStr, utcToZoned, weekdayOf, zonedToUtc, minuteToHHMM } from "./time";

export type MinuteInterval = { start: number; end: number };
export type BusyRange = { startsAt: Date; endsAt: Date };

export type WeeklyHour = { weekday: number; startMinute: number; endMinute: number };
export type DateException = { date: string; startMinute: number | null; endMinute: number | null };

export type Slot = {
  /** "09:30" en hora local del lavadero */
  time: string;
  minute: number;
  /** ISO UTC */
  startsAt: string;
  /** Lugares libres en ese horario (capacidad − ocupación pico). */
  remaining: number;
};

/** Tramos de apertura de una fecha, aplicando excepciones. Devuelve tramos ordenados y fusionados. */
export function getOpenIntervals(dateStr: string, weekly: WeeklyHour[], exceptions: DateException[]): MinuteInterval[] {
  const forDate = exceptions.filter((e) => e.date === dateStr);
  let intervals: MinuteInterval[];
  if (forDate.length > 0) {
    intervals = forDate
      .filter((e) => e.startMinute !== null && e.endMinute !== null)
      .map((e) => ({ start: e.startMinute!, end: e.endMinute! }));
  } else {
    const wd = weekdayOf(dateStr);
    intervals = weekly.filter((h) => h.weekday === wd).map((h) => ({ start: h.startMinute, end: h.endMinute }));
  }
  return mergeIntervals(intervals);
}

export function mergeIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: MinuteInterval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Ocupación máxima simultánea de `ranges` dentro de [from, to). Barrido de eventos O(n log n). */
export function peakOverlap(ranges: BusyRange[], from: Date, to: Date): number {
  const f = from.getTime();
  const t = to.getTime();
  const events: [number, number][] = [];
  for (const r of ranges) {
    const s = Math.max(r.startsAt.getTime(), f);
    const e = Math.min(r.endsAt.getTime(), t);
    if (s < e) {
      events.push([s, 1], [e, -1]);
    }
  }
  // En empate, primero las salidas: un turno que termina 10:00 no choca con uno que empieza 10:00.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    if (current > peak) peak = current;
  }
  return peak;
}

/** ¿El rango [startMinute, startMinute+duration) entra completo en algún tramo abierto? */
export function fitsInOpenHours(startMinute: number, durationMinutes: number, open: MinuteInterval[]): boolean {
  return open.some((i) => startMinute >= i.start && startMinute + durationMinutes <= i.end);
}

export type ComputeSlotsInput = {
  dateStr: string;
  timezone: string;
  open: MinuteInterval[];
  intervalMinutes: number;
  durationMinutes: number;
  capacity: number;
  busy: BusyRange[];
  now: Date;
  minLeadMinutes: number;
};

export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const { dateStr, timezone, open, intervalMinutes, durationMinutes, capacity, busy, now, minLeadMinutes } = input;
  const earliest = now.getTime() + minLeadMinutes * 60_000;
  const slots: Slot[] = [];
  for (const window of open) {
    for (let m = window.start; m + durationMinutes <= window.end; m += intervalMinutes) {
      const start = zonedToUtc(dateStr, m, timezone);
      if (start.getTime() < earliest) continue;
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const remaining = capacity - peakOverlap(busy, start, end);
      if (remaining > 0) {
        slots.push({ time: minuteToHHMM(m), minute: m, startsAt: start.toISOString(), remaining });
      }
    }
  }
  return slots;
}

/** ¿Un horario puntual es reservable online? (misma regla que computeSlots, para validar en el servidor) */
export function isSlotBookable(input: Omit<ComputeSlotsInput, "dateStr"> & { startsAt: Date }): boolean {
  const { dateStr, minute } = utcToZoned(input.startsAt, input.timezone);
  return computeSlots({ ...input, dateStr }).some((s) => s.minute === minute && s.startsAt === input.startsAt.toISOString());
}

/** Fechas que se muestran en el selector: desde hoy hasta hoy + maxDaysAhead. */
export function bookableDates(timezone: string, maxDaysAhead: number, now: Date = new Date()): string[] {
  const today = todayStr(timezone, now);
  return Array.from({ length: maxDaysAhead + 1 }, (_, i) => addDaysStr(today, i));
}
