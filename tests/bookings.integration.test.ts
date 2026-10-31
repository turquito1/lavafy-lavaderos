import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/pg";
import { addDaysStr, todayStr, zonedToUtc, weekdayOf } from "@/lib/time";

const TZ = "America/Argentina/Cordoba";
let stop: () => Promise<void>;
let mod: typeof import("@/server/bookings");
let dbm: typeof import("@/db");
let businessId: string;
let serviceId: string;
const customers: string[] = [];
const day = addDaysStr(todayStr(TZ), 2);

beforeAll(async () => {
  ({ stop } = await startTestDb());
  dbm = await import("@/db");
  mod = await import("@/server/bookings");
  const { db, schema } = dbm;
  const [b] = await db
    .insert(schema.businesses)
    .values({ slug: "test", name: "Test", capacity: 2, slotIntervalMinutes: 30, status: "active", minLeadMinutes: 0 })
    .returning();
  businessId = b.id;
  await db.insert(schema.openingHours).values({ businessId, weekday: weekdayOf(day), startMinute: 540, endMinute: 720 });
  const [s] = await db.insert(schema.services).values({ businessId, name: "Lavado completo" }).returning();
  serviceId = s.id;
  await db.insert(schema.servicePrices).values({ serviceId, vehicleType: "auto", price: 15000, durationMinutes: 60 });
  for (let i = 0; i < 6; i++) {
    const [u] = await db.insert(schema.users).values({ email: `c${i}@test.com`, name: `Cliente ${i}` }).returning();
    customers.push(u.id);
  }
});
afterAll(async () => stop?.());

const book = (i: number, hhmm = "09:00", plate = `AB${100 + i}CD`) => {
  const [h, m] = hhmm.split(":").map(Number);
  return mod.createOnlineBooking({
    businessId,
    customerId: customers[i],
    customerName: `Cliente ${i}`,
    customerPhone: "3511234567",
    customerEmail: `c${i}@test.com`,
    serviceId,
    vehicleType: "auto",
    plate,
    startsAt: zonedToUtc(day, h * 60 + m, TZ),
  });
};

describe("turnos (integración con Postgres)", () => {
  it("calcula horarios disponibles", async () => {
    const [b] = await dbm.db.select().from(dbm.schema.businesses);
    const slots = await mod.getAvailableSlots({ business: b, durationMinutes: 60, dateStr: day });
    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("5 reservas simultáneas al mismo horario: entran exactamente 2 (capacidad)", async () => {
    const results = await Promise.allSettled([0, 1, 2, 3, 4].map((i) => book(i)));
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(2);
    expect(failed.every((f) => f.reason?.code === "SLOT_TAKEN")).toBe(true);
    const [b] = await dbm.db.select().from(dbm.schema.businesses);
    const slots = await mod.getAvailableSlots({ business: b, durationMinutes: 60, dateStr: day });
    expect(slots.map((s) => s.time)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("rechaza horarios fuera de grilla o de horario", async () => {
    await expect(book(5, "10:10")).rejects.toMatchObject({ code: "OUTSIDE_HOURS" });
    await expect(book(5, "11:30")).rejects.toMatchObject({ code: "OUTSIDE_HOURS" });
  });

  it("cancelar libera el lugar y reprogramar valida disponibilidad", async () => {
    const all = await dbm.db.select().from(dbm.schema.bookings);
    const first = all[0];
    await expect(
      mod.rescheduleBooking({ bookingId: first.id, startsAt: zonedToUtc(day, 600, TZ), actor: { kind: "customer", userId: first.customerId! } }),
    ).resolves.toBeTruthy();
    const second = all[1];
    await mod.cancelBooking({ bookingId: second.id, actor: { kind: "customer", userId: second.customerId! } });
    const r = await book(5, "09:00");
    expect(r.booking.status).toBe("confirmed");
    expect(r.booking.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("un cliente no puede tocar turnos de otro", async () => {
    const [anyBooking] = await dbm.db.select().from(dbm.schema.bookings);
    await expect(mod.cancelBooking({ bookingId: anyBooking.id, actor: { kind: "customer", userId: customers[4] } })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("carga manual respeta capacidad salvo que se fuerce", async () => {
    const base = { businessId, actorUserId: customers[0], source: "manual" as const, serviceId, vehicleType: "auto" as const, customerName: "Mostrador" };
    const startsAt = zonedToUtc(day, 600, TZ); // 10:00 → ya hay 1 (reprogramado) 
    await mod.createManualBooking({ ...base, startsAt });
    await expect(mod.createManualBooking({ ...base, startsAt })).rejects.toMatchObject({ code: "CAPACITY" });
    await expect(mod.createManualBooking({ ...base, startsAt, force: true })).resolves.toBeTruthy();
  });
});
