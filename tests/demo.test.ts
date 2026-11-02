import { describe, expect, it } from "vitest";
import { buildDemoBookings } from "@/lib/demo-data";
import { DEFAULT_TZ, todayStr, utcToZoned, zonedToUtc } from "@/lib/time";

// Miércoles 4/11/2026 a las 11:20 en Córdoba.
const NOW = zonedToUtc("2026-11-04", 11 * 60 + 20, DEFAULT_TZ);

describe("buildDemoBookings", () => {
  for (const seed of [1, 42, 999]) {
    const list = buildDemoBookings(NOW, "+5493511234567", seed);

    it(`semilla ${seed}: arma una agenda creíble`, () => {
      expect(list.length).toBeGreaterThan(60);
      const today = list.filter((b) => utcToZoned(b.startsAt, DEFAULT_TZ).dateStr === todayStr(DEFAULT_TZ, NOW));
      expect(today.length).toBeGreaterThan(8);
      expect(today.some((b) => b.status === "in_progress")).toBe(true);
    });

    it(`semilla ${seed}: los estados tienen sentido con la hora`, () => {
      for (const b of list) {
        const future = b.startsAt > NOW;
        const ended = b.endsAt <= NOW;
        if (future) expect(["confirmed", "cancelled"]).toContain(b.status);
        if (ended) expect(["completed", "ready", "no_show", "cancelled"]).toContain(b.status);
        if (b.status === "in_progress") expect(b.startsAt <= NOW && NOW < b.endsAt).toBe(true);
        if (b.source === "walk_in") expect(future).toBe(false);
        expect(b.createdAt <= NOW).toBe(true);
        expect(b.customerPhone).toBe("+5493511234567");
      }
    });

    it(`semilla ${seed}: nunca hay más de 3 autos a la vez y respeta el horario`, () => {
      for (const b of list) {
        const start = utcToZoned(b.startsAt, DEFAULT_TZ);
        const end = utcToZoned(b.endsAt, DEFAULT_TZ);
        expect(end.dateStr).toBe(start.dateStr);
        if (start.weekday === 0) expect(start.minute >= 9 * 60 && end.minute <= 13 * 60).toBe(true);
        else expect(start.minute >= 8 * 60 && end.minute <= 20 * 60).toBe(true);
        const overlapping = list.filter((o) => o.startsAt < b.endsAt && b.startsAt < o.endsAt && o.startsAt <= b.startsAt);
        expect(overlapping.length).toBeLessThanOrEqual(3);
      }
    });
  }
});
