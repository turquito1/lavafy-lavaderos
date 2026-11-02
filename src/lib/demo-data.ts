import type { BookingStatus, VehicleType } from "@/db/schema";
import { addDaysStr, DEFAULT_TZ, todayStr, weekdayOf, zonedToUtc } from "./time";

/** Datos del lavadero demo (lavafy.com.ar/demo). Funciones puras: no tocan la base. */

export const DEMO_SLUG = "demo";
export const DEMO_TZ = DEFAULT_TZ;
export const DEMO_CAPACITY = 3;
const TZ = DEMO_TZ;
const CAPACITY = DEMO_CAPACITY;

/** Lunes a viernes 8–20, sábado 8–18, domingo 9–13 (minutos desde medianoche). */
export const DEMO_HOURS: Record<number, [number, number][]> = {
  0: [[9 * 60, 13 * 60]],
  1: [[8 * 60, 20 * 60]],
  2: [[8 * 60, 20 * 60]],
  3: [[8 * 60, 20 * 60]],
  4: [[8 * 60, 20 * 60]],
  5: [[8 * 60, 20 * 60]],
  6: [[8 * 60, 18 * 60]],
};

type Prices = Partial<Record<VehicleType, [price: number, minutes: number]>>;
export const DEMO_CATALOG: { key: string; name: string; description: string; weight: number; prices: Prices }[] = [
  { key: "exterior", name: "Lavado exterior", description: "Carrocería, llantas y vidrios.", weight: 34, prices: { auto: [12000, 30], suv: [15000, 40], pickup: [17000, 45], moto: [8000, 20] } },
  { key: "completo", name: "Lavado completo", description: "Exterior + interior, aspirado y silicona en plásticos.", weight: 36, prices: { auto: [20000, 60], suv: [25000, 75], pickup: [28000, 90] } },
  { key: "motor", name: "Lavado de motor", description: "Desengrasado y protección del vano motor.", weight: 10, prices: { auto: [15000, 45], suv: [18000, 45], pickup: [18000, 45] } },
  { key: "tapizados", name: "Limpieza de tapizados", description: "Lavado profundo de asientos, alfombras y techo.", weight: 8, prices: { auto: [45000, 180], suv: [55000, 210], pickup: [55000, 210] } },
  { key: "detailing", name: "Detailing premium", description: "Descontaminado, pulido y cera. Dejalo a la mañana, retiralo a la tarde.", weight: 12, prices: { auto: [90000, 240], suv: [110000, 300], pickup: [120000, 300] } },
];

const NAMES = [
  "Martina Gómez", "Lucas Fernández", "Sofía Romero", "Diego Paz", "Camila Ruiz", "Juan Pérez", "Valentina Díaz", "Mateo Sosa",
  "Agustina Torres", "Nicolás Álvarez", "Florencia Castro", "Tomás Herrera", "Julieta Medina", "Facundo Ríos", "Micaela Suárez",
  "Santiago Molina", "Carolina Ortiz", "Franco Benítez", "Lucía Acosta", "Gonzalo Vera", "Paula Rojas", "Ezequiel Luna",
  "Rocío Cabrera", "Matías Giménez", "Antonella Ferreyra", "Joaquín Peralta", "Brenda Navarro", "Ramiro Quiroga",
  "Milagros Aguirre", "Federico Villalba",
];

const CARS: { brand: string; model: string; type: VehicleType }[] = [
  { brand: "Toyota", model: "Etios", type: "auto" },
  { brand: "Fiat", model: "Cronos", type: "auto" },
  { brand: "Peugeot", model: "208", type: "auto" },
  { brand: "Chevrolet", model: "Onix", type: "auto" },
  { brand: "Volkswagen", model: "Gol Trend", type: "auto" },
  { brand: "Renault", model: "Sandero", type: "auto" },
  { brand: "Toyota", model: "Corolla", type: "auto" },
  { brand: "Volkswagen", model: "Polo", type: "auto" },
  { brand: "Jeep", model: "Renegade", type: "suv" },
  { brand: "Volkswagen", model: "T-Cross", type: "suv" },
  { brand: "Peugeot", model: "2008", type: "suv" },
  { brand: "Chevrolet", model: "Tracker", type: "suv" },
  { brand: "Toyota", model: "Hilux", type: "pickup" },
  { brand: "Volkswagen", model: "Amarok", type: "pickup" },
  { brand: "Ford", model: "Ranger", type: "pickup" },
  { brand: "Honda", model: "CB 190", type: "moto" },
];

const CUSTOMER_NOTES = ["Tiene pelos de perro en el asiento de atrás.", "Si pueden, sacar la mancha del techo.", "Lo pasa a buscar mi señora.", "Llego 10 min tarde, perdón."];
const INTERNAL_NOTES = ["Rayón en la puerta trasera derecha (ya estaba).", "Cliente frecuente, viene cada 15 días.", "Pidió que no le pongan perfume."];

/** PRNG con semilla (mulberry32): la misma semilla da la misma demo, útil para tests. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

export type DemoBookingSeed = {
  customerName: string;
  customerPhone: string | null;
  serviceKey: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  vehicleType: VehicleType;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  status: BookingStatus;
  source: "online" | "manual" | "walk_in";
  notes: string | null;
  internalNotes: string | null;
  cancelledAt: Date | null;
  cancelledBy: "customer" | null;
};

/** Arma los turnos de la demo (función pura: no toca la base). */
export function buildDemoBookings(now: Date, customerPhone: string | null, seed = 42): DemoBookingSeed[] {
  const random = rng(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const chance = (p: number) => random() < p;
  const plate = () =>
    chance(0.75)
      ? `${pick([..."AAAAAB"])}${pick([..."ABCDEFG"])}${String(Math.floor(random() * 900) + 100)}${pick([...LETTERS])}${pick([...LETTERS])}`
      : `${pick([..."FGHIJKLMNOP"])}${pick([...LETTERS])}${pick([...LETTERS])}${String(Math.floor(random() * 900) + 100)}`;
  const totalWeight = DEMO_CATALOG.reduce((s, c) => s + c.weight, 0);
  const pickService = (type: VehicleType) => {
    if (type === "moto") return DEMO_CATALOG[0];
    let r = random() * totalWeight;
    for (const c of DEMO_CATALOG) if ((r -= c.weight) < 0) return c;
    return DEMO_CATALOG[1];
  };

  const today = todayStr(TZ, now);
  const nowMs = now.getTime();
  const out: DemoBookingSeed[] = [];

  for (let offset = -6; offset <= 6; offset++) {
    const day = addDaysStr(today, offset);
    const ranges = DEMO_HOURS[weekdayOf(day)] ?? [];
    // Más movimiento hoy y en los días pasados; la agenda se va vaciando hacia adelante.
    const density = offset < 0 ? 0.55 : offset === 0 ? 0.7 : Math.max(0.15, 0.55 - offset * 0.08);
    const busy: [number, number][] = [];
    // Nombres sin repetir en el mismo día.
    const names = [...NAMES];
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }

    for (const [open, close] of ranges) {
      for (let minute = open; minute < close; minute += 30) {
        // Hasta 2 autos que arrancan en el mismo horario.
        for (let k = 0; k < 2; k++) {
          if (!chance(k === 0 ? density : density * 0.35)) continue;
          const car = pick(CARS);
          const svc = pickService(car.type);
          const [price, minutes] = svc.prices[car.type] ?? svc.prices.auto!;
          const end = minute + minutes;
          if (end > close) continue;
          if (busy.filter(([s, e]) => s < end && minute < e).length >= CAPACITY) continue;
          busy.push([minute, end]);

          const startsAt = zonedToUtc(day, minute, TZ);
          const endsAt = new Date(startsAt.getTime() + minutes * 60_000);
          const source = chance(0.65) ? "online" : chance(0.6) ? "manual" : "walk_in";

          let status: BookingStatus;
          if (endsAt.getTime() <= nowMs) {
            const sinceEnd = nowMs - endsAt.getTime();
            if (offset === 0 && sinceEnd < 60 * 60_000) status = "ready";
            else status = chance(0.9) ? "completed" : chance(0.4) ? "no_show" : "cancelled";
          } else if (startsAt.getTime() <= nowMs) status = "in_progress";
          else status = chance(0.93) ? "confirmed" : "cancelled";
          // Un walk-in no se cancela ni "no viene": llegó.
          if (source === "walk_in" && (status === "cancelled" || status === "no_show")) status = "completed";
          if (source === "walk_in" && startsAt.getTime() > nowMs) continue;

          const created = Math.min(nowMs - 5 * 60_000, startsAt.getTime() - (source === "walk_in" ? 0 : (1 + Math.floor(random() * 72)) * 3600_000));
          out.push({
            customerName: names.pop() ?? pick(NAMES),
            customerPhone,
            serviceKey: svc.key,
            serviceName: svc.name,
            price,
            durationMinutes: minutes,
            vehicleType: car.type,
            vehiclePlate: plate(),
            vehicleBrand: car.brand,
            vehicleModel: car.model,
            startsAt,
            endsAt,
            createdAt: new Date(created),
            status,
            source,
            notes: source === "online" && chance(0.15) ? pick(CUSTOMER_NOTES) : null,
            internalNotes: chance(0.08) ? pick(INTERNAL_NOTES) : null,
            cancelledAt: status === "cancelled" ? new Date(Math.min(nowMs, startsAt.getTime() - 3 * 3600_000)) : null,
            cancelledBy: status === "cancelled" ? "customer" : null,
          });
        }
      }
    }
  }
  return out;
}

