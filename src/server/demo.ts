import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, businesses, businessMembers, businessPhotos, openingHours, scheduleExceptions, servicePrices, services } from "@/db/schema";
import type { VehicleType } from "@/db/schema";
import { todayStr, utcToZoned } from "@/lib/time";
import { buildDemoBookings, DEMO_CAPACITY, DEMO_CATALOG, DEMO_HOURS, DEMO_SLUG, DEMO_TZ } from "@/lib/demo-data";

export { DEMO_SLUG };

/**
 * Lavadero de muestra para mostrarle Lavafy a los dueños: lavafy.com.ar/demo.
 * `resetDemoBusiness` lo crea (o lo deja como nuevo) con servicios, fotos y turnos de 6 días para atrás
 * y 6 para adelante, con estados que tienen sentido según la hora en que se genera.
 * No aparece en el directorio público (is_demo) y sus clientes no tienen mail, así que no salen avisos.
 */

const TZ = DEMO_TZ;

const BUSINESS = {
  slug: DEMO_SLUG,
  name: "Lavadero Demo",
  description: "Lavado a mano, interiores y detailing. Dejás el auto y te avisamos por WhatsApp cuando está listo.",
  address: "Av. Colón 1234",
  city: "Córdoba",
  province: "Córdoba",
  lat: -31.4135,
  lng: -64.1985,
  instagram: "@lavafy_",
  logoUrl: "/landing/assets/logo.png",
  coverUrl: "/landing/assets/trabajo-1.jpg",
  timezone: TZ,
  capacity: DEMO_CAPACITY,
  slotIntervalMinutes: 30,
  minLeadMinutes: 30,
  maxDaysAhead: 30,
  cancelWindowMinutes: 60,
  requiresApproval: false,
  status: "active" as const,
  isDemo: true,
  plan: "demo",
  trialEndsAt: null,
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function demoCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `DM${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")}`;
}

/**
 * Crea o regenera el lavadero demo. `ownerId` queda como dueño (para entrar al panel);
 * `customerPhone` se usa en todos los clientes de prueba, así los botones de WhatsApp te escriben a vos.
 */
export async function resetDemoBusiness({ ownerId, customerPhone, now = new Date() }: { ownerId: string; customerPhone: string | null; now?: Date }) {
  const seeds = buildDemoBookings(now, customerPhone, Math.floor(now.getTime() / 3600_000));

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, DEMO_SLUG));
    const values = { ...BUSINESS, whatsapp: customerPhone, phone: customerPhone };
    const businessId = existing
      ? (await tx.update(businesses).set(values).where(eq(businesses.id, existing.id)).returning({ id: businesses.id }))[0].id
      : (await tx.insert(businesses).values(values).returning({ id: businesses.id }))[0].id;

    await tx.insert(businessMembers).values({ businessId, userId: ownerId, role: "owner" }).onConflictDoNothing();

    // Todo de cero (los turnos primero: apuntan a los servicios).
    await tx.delete(bookings).where(eq(bookings.businessId, businessId));
    await tx.delete(services).where(eq(services.businessId, businessId));
    await tx.delete(openingHours).where(eq(openingHours.businessId, businessId));
    await tx.delete(scheduleExceptions).where(eq(scheduleExceptions.businessId, businessId));
    await tx.delete(businessPhotos).where(eq(businessPhotos.businessId, businessId));

    await tx.insert(openingHours).values(
      Object.entries(DEMO_HOURS).flatMap(([weekday, ranges]) => ranges.map(([startMinute, endMinute]) => ({ businessId, weekday: Number(weekday), startMinute, endMinute }))),
    );
    await tx.insert(businessPhotos).values([2, 3, 4, 5, 6].map((n, i) => ({ businessId, url: `/landing/assets/trabajo-${n}.jpg`, sortOrder: i })));

    const serviceIds = new Map<string, string>();
    for (const [i, c] of DEMO_CATALOG.entries()) {
      const [svc] = await tx.insert(services).values({ businessId, name: c.name, description: c.description, sortOrder: i }).returning({ id: services.id });
      serviceIds.set(c.key, svc.id);
      await tx.insert(servicePrices).values(
        Object.entries(c.prices).map(([vehicleType, [price, durationMinutes]]) => ({ serviceId: svc.id, vehicleType: vehicleType as VehicleType, price, durationMinutes })),
      );
    }

    if (seeds.length > 0) {
      await tx.insert(bookings).values(
        seeds.map(({ serviceKey, createdAt, ...b }) => ({
          ...b,
          code: demoCode(),
          businessId,
          serviceId: serviceIds.get(serviceKey) ?? null,
          customerEmail: null,
          customerId: null,
          createdAt,
          updatedAt: createdAt,
          // Ya pasaron o son de prueba: que el cron de recordatorios no los tome.
          reminderSentAt: now,
        })),
      );
    }

    const today = todayStr(TZ, now);
    const todayCount = seeds.filter((s) => utcToZoned(s.startsAt, TZ).dateStr === today).length;
    return { businessId, slug: DEMO_SLUG, bookings: seeds.length, today: todayCount };
  });
}
