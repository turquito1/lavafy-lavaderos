/**
 * Utilidades de fecha/hora con zona horaria. Sin dependencias del servidor:
 * se usan tanto en el backend como en el cliente.
 *
 * Convención: un "dateStr" es una fecha de calendario local del lavadero en formato YYYY-MM-DD,
 * y un "minute" son minutos desde la medianoche local (0–1440).
 */
import { TZDate } from "@date-fns/tz";

export const DEFAULT_TZ = "America/Argentina/Cordoba";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Fecha local + minutos → instante UTC. */
export function zonedToUtc(dateStr: string, minute: number, timezone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const h = Math.floor(minute / 60);
  const min = minute % 60;
  return new Date(new TZDate(y, m - 1, d, h, min, 0, timezone).getTime());
}

/** Instante → partes locales en la zona del lavadero. */
export function utcToZoned(date: Date, timezone: string): { dateStr: string; minute: number; weekday: number } {
  const z = new TZDate(date.getTime(), timezone);
  return {
    dateStr: `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`,
    minute: z.getHours() * 60 + z.getMinutes(),
    weekday: z.getDay(),
  };
}

/** Hora actual en ms. En server components usalo solo después de una API dinámica (cookies, connection…). */
export const nowMs = () => Date.now();

export function todayStr(timezone: string, now: Date = new Date()): string {
  return utcToZoned(now, timezone).dateStr;
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Día de la semana (0 = domingo) de una fecha de calendario. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Inicio y fin (exclusivo) de un día local, en UTC. */
export function dayRangeUtc(dateStr: string, timezone: string): { from: Date; to: Date } {
  return { from: zonedToUtc(dateStr, 0, timezone), to: zonedToUtc(addDaysStr(dateStr, 1), 0, timezone) };
}

export function minuteToHHMM(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

export function hhmmToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Formateo en castellano ───────────────────────────────────────────────────

export function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(date);
}

/** "sábado 31 de octubre" */
export function formatDateLong(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: timezone }).format(date);
}

/** "sáb 31/10" */
export function formatDateShort(date: Date, timezone: string): string {
  const wd = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: timezone }).format(date).replace(".", "");
  const dm = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", timeZone: timezone }).format(date);
  return `${wd} ${dm}`;
}

/** Para un dateStr (sin hora): partes para mostrar en la tira de días. */
export function dateStrParts(dateStr: string): { weekdayShort: string; day: number; monthShort: string; long: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-AR", { ...o, timeZone: "UTC" }).format(dt);
  return {
    weekdayShort: fmt({ weekday: "short" }).replace(".", ""),
    day: d,
    monthShort: fmt({ month: "short" }).replace(".", ""),
    long: fmt({ weekday: "long", day: "numeric", month: "long" }),
  };
}

/** "lunes 2 de noviembre" → "Lunes 2 de noviembre" */
export function ucfirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
/** Orden de la semana para mostrar (arranca el lunes). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
