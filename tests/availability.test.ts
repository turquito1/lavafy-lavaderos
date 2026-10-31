import { describe, expect, it } from "vitest";
import { computeSlots, getOpenIntervals, peakOverlap, mergeIntervals } from "@/lib/availability";
import { zonedToUtc, utcToZoned, addDaysStr, weekdayOf } from "@/lib/time";

const TZ = "America/Argentina/Cordoba";
const D = "2026-11-02"; // lunes
const at = (hhmm: string, date = D) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(date, h * 60 + m, TZ);
};
const busy = (from: string, to: string) => ({ startsAt: at(from), endsAt: at(to) });
const base = {
  dateStr: D,
  timezone: TZ,
  open: [{ start: 9 * 60, end: 12 * 60 }],
  intervalMinutes: 30,
  durationMinutes: 60,
  capacity: 2,
  busy: [] as { startsAt: Date; endsAt: Date }[],
  now: new Date("2026-11-01T12:00:00Z"),
  minLeadMinutes: 60,
};

describe("time", () => {
  it("convierte hora local de Córdoba (UTC-3) a UTC", () => {
    expect(at("09:00").toISOString()).toBe("2026-11-02T12:00:00.000Z");
    expect(utcToZoned(new Date("2026-11-02T02:30:00Z"), TZ)).toEqual({ dateStr: "2026-11-01", minute: 23 * 60 + 30, weekday: 0 });
  });
  it("suma días y calcula el día de semana", () => {
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf(D)).toBe(1);
  });
});

describe("getOpenIntervals", () => {
  const weekly = [
    { weekday: 1, startMinute: 900, endMinute: 1200 },
    { weekday: 1, startMinute: 540, endMinute: 780 },
  ];
  it("usa el horario semanal ordenado", () => {
    expect(getOpenIntervals(D, weekly, [])).toEqual([{ start: 540, end: 780 }, { start: 900, end: 1200 }]);
  });
  it("una excepción de cierre deja el día cerrado", () => {
    expect(getOpenIntervals(D, weekly, [{ date: D, startMinute: null, endMinute: null }])).toEqual([]);
  });
  it("una excepción con horario reemplaza el semanal", () => {
    expect(getOpenIntervals(D, weekly, [{ date: D, startMinute: 600, endMinute: 720 }])).toEqual([{ start: 600, end: 720 }]);
  });
  it("fusiona tramos superpuestos", () => {
    expect(mergeIntervals([{ start: 0, end: 60 }, { start: 30, end: 90 }, { start: 90, end: 100 }])).toEqual([{ start: 0, end: 100 }]);
  });
});

describe("peakOverlap", () => {
  it("turnos que se tocan en el borde no se superponen", () => {
    expect(peakOverlap([busy("09:00", "10:00"), busy("10:00", "11:00")], at("09:00"), at("11:00"))).toBe(1);
  });
  it("cuenta el pico real, no la cantidad total", () => {
    // A 9-10, B 10-11 y C 9:30-10:30 → pico 2, aunque hay 3 superpuestos con 9-11
    expect(peakOverlap([busy("09:00", "10:00"), busy("10:00", "11:00"), busy("09:30", "10:30")], at("09:00"), at("11:00"))).toBe(2);
  });
});

describe("computeSlots", () => {
  it("genera horarios que terminan antes del cierre", () => {
    expect(computeSlots(base).map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });
  it("respeta la capacidad", () => {
    const slots = computeSlots({ ...base, busy: [busy("09:00", "10:00"), busy("09:00", "10:00")] });
    expect(slots.map((s) => s.time)).toEqual(["10:00", "10:30", "11:00"]);
    const one = computeSlots({ ...base, busy: [busy("09:00", "10:00")] });
    expect(one.find((s) => s.time === "09:30")?.remaining).toBe(1);
    expect(one.find((s) => s.time === "10:00")?.remaining).toBe(2);
  });
  it("respeta la anticipación mínima", () => {
    const now = at("08:30");
    expect(computeSlots({ ...base, now, minLeadMinutes: 60 }).map((s) => s.time)).toEqual(["09:30", "10:00", "10:30", "11:00"]);
  });
  it("sin tramos abiertos no hay horarios", () => {
    expect(computeSlots({ ...base, open: [] })).toEqual([]);
  });
});
