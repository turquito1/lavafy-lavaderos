/**
 * Datos de prueba: `npm run db:seed`. Crea 2 lavaderos publicados con servicios, horarios y turnos.
 * El dueño es el mail de SEED_OWNER_EMAIL (por defecto dueno@lavafy.test) → entrá con el login de desarrollo.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

const { db, pool, schema } = await import("../src/db/index");
const { addDaysStr, todayStr, zonedToUtc } = await import("../src/lib/time");
const { eq } = await import("drizzle-orm");

const TZ = "America/Argentina/Cordoba";
const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "dueno@lavafy.test";

async function upsertUser(email: string, name: string) {
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) return existing;
  const [u] = await db.insert(schema.users).values({ email, name, emailVerified: new Date() }).returning();
  return u;
}

const owner = await upsertUser(ownerEmail, "Dueño Demo");
const customer = await upsertUser("cliente@lavafy.test", "Cliente Demo");

type Seed = { slug: string; name: string; address: string; city: string; lat: number; lng: number; capacity: number; description: string };
const seeds: Seed[] = [
  { slug: "lavadero-demo", name: "Lavadero Demo", address: "Av. Colón 1234", city: "Córdoba", lat: -31.4135, lng: -64.1985, capacity: 2, description: "Lavadero de prueba de Lavafy. Lavados a mano, productos premium y atención rápida." },
  { slug: "el-turco-lavados", name: "El Turco Lavados", address: "Ruta 20 km 15", city: "Malagueño", lat: -31.4646, lng: -64.3584, capacity: 3, description: "Lavado y detailing en Malagueño. Dejás el auto y te avisamos cuando está listo." },
];

for (const s of seeds) {
  const [exists] = await db.select().from(schema.businesses).where(eq(schema.businesses.slug, s.slug));
  if (exists) {
    console.log(`• ${s.slug} ya existe, lo salteo`);
    continue;
  }
  const [b] = await db
    .insert(schema.businesses)
    .values({ ...s, province: "Córdoba", status: "active", whatsapp: "+5493511234567", phone: "3511234567", instagram: "@lavafy_", minLeadMinutes: 30 })
    .returning();
  await db.insert(schema.businessMembers).values({ businessId: b.id, userId: owner.id, role: "owner" });
  await db.insert(schema.openingHours).values([
    ...[1, 2, 3, 4, 5].flatMap((weekday) => [
      { businessId: b.id, weekday, startMinute: 8 * 60, endMinute: 13 * 60 },
      { businessId: b.id, weekday, startMinute: 15 * 60, endMinute: 20 * 60 },
    ]),
    { businessId: b.id, weekday: 6, startMinute: 9 * 60, endMinute: 14 * 60 },
  ]);
  const catalog = [
    { name: "Lavado exterior", description: "Carrocería, llantas y vidrios.", prices: { auto: [12000, 30], suv: [15000, 40], pickup: [17000, 45], moto: [8000, 20] } },
    { name: "Lavado completo", description: "Exterior + interior, aspirado y silicona en plásticos.", prices: { auto: [20000, 60], suv: [25000, 75], pickup: [28000, 90] } },
    { name: "Lavado de motor", description: "Desengrasado y protección del vano motor.", prices: { auto: [15000, 45], suv: [18000, 45], pickup: [18000, 45] } },
    { name: "Detailing premium", description: "Descontaminado, pulido y cera. Dejalo a la mañana, retiralo a la tarde.", prices: { auto: [90000, 240], suv: [110000, 300] } },
  ] as const;
  const created: { id: string; name: string; auto: readonly [number, number] }[] = [];
  for (const [i, c] of catalog.entries()) {
    const [svc] = await db.insert(schema.services).values({ businessId: b.id, name: c.name, description: c.description, sortOrder: i }).returning();
    await db.insert(schema.servicePrices).values(
      Object.entries(c.prices).map(([vehicleType, [price, durationMinutes]]) => ({ serviceId: svc.id, vehicleType: vehicleType as "auto", price, durationMinutes })),
    );
    created.push({ id: svc.id, name: c.name, auto: c.prices.auto });
  }

  // Algunos turnos para hoy y mañana
  const today = todayStr(TZ);
  const demo = [
    { day: today, h: 9, svc: 0, name: "Martina Gómez", plate: "AC456BD", status: "completed" as const },
    { day: today, h: 10, svc: 1, name: "Lucas Fernández", plate: "AE123FG", status: "in_progress" as const },
    { day: today, h: 10, svc: 0, name: "Sofía Romero", plate: "AB987CD", status: "ready" as const },
    { day: today, h: 16, svc: 2, name: "Diego Paz", plate: "OLP234", status: "confirmed" as const },
    { day: today, h: 17, svc: 1, name: "Camila Ruiz", plate: "AF555GH", status: "pending" as const },
    { day: addDaysStr(today, 1), h: 9, svc: 3, name: "Juan Pérez", plate: "AD321XY", status: "confirmed" as const },
  ];
  for (const [i, d] of demo.entries()) {
    const sv = created[d.svc];
    const startsAt = zonedToUtc(d.day, d.h * 60, TZ);
    await db.insert(schema.bookings).values({
      code: `${s.slug.slice(0, 2).toUpperCase()}DEM${i}`,
      businessId: b.id,
      customerId: i === 3 ? customer.id : null,
      customerName: d.name,
      customerPhone: "3515550000",
      customerEmail: i === 3 ? customer.email : null,
      serviceId: sv.id,
      serviceName: sv.name,
      price: sv.auto[0],
      durationMinutes: sv.auto[1],
      vehicleType: "auto",
      vehiclePlate: d.plate,
      vehicleBrand: "Toyota",
      vehicleModel: "Etios",
      startsAt,
      endsAt: new Date(startsAt.getTime() + sv.auto[1] * 60_000),
      status: d.status,
      source: i % 3 === 0 ? "manual" : "online",
    });
  }
  console.log(`✅ ${s.name} → /${s.slug}`);
}

await pool.end();
console.log(`Dueño: ${ownerEmail} · Cliente: cliente@lavafy.test (entrá con "Entrar sin Google")`);
