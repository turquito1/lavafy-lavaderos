/** Consultas de lectura compartidas por varias pantallas. */
import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  businesses,
  openingHours,
  scheduleExceptions,
  servicePrices,
  services,
  vehicles,
  type Business,
  type VehicleType,
} from "@/db/schema";
import { todayStr } from "@/lib/time";

export const getBusinessBySlug = cache(async (slug: string): Promise<Business | null> => {
  const [b] = await db.select().from(businesses).where(eq(businesses.slug, slug.toLowerCase()));
  return b ?? null;
});

export type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  prices: { vehicleType: VehicleType; price: number; durationMinutes: number }[];
};

/** Servicios con sus precios por tipo de vehículo. */
export async function getCatalog(businessId: string, opts: { onlyActive?: boolean } = {}): Promise<CatalogService[]> {
  const rows = await db
    .select()
    .from(services)
    .where(opts.onlyActive ? and(eq(services.businessId, businessId), eq(services.active, true)) : eq(services.businessId, businessId))
    .orderBy(asc(services.sortOrder), asc(services.createdAt));
  if (rows.length === 0) return [];
  const prices = await db
    .select()
    .from(servicePrices)
    .where(inArray(servicePrices.serviceId, rows.map((r) => r.id)));
  const order: VehicleType[] = ["auto", "suv", "pickup", "moto"];
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    active: s.active,
    sortOrder: s.sortOrder,
    prices: prices
      .filter((p) => p.serviceId === s.id)
      .sort((a, b) => order.indexOf(a.vehicleType) - order.indexOf(b.vehicleType))
      .map((p) => ({ vehicleType: p.vehicleType, price: p.price, durationMinutes: p.durationMinutes })),
  }));
}

export async function getWeeklyHours(businessId: string) {
  return db
    .select({ id: openingHours.id, weekday: openingHours.weekday, startMinute: openingHours.startMinute, endMinute: openingHours.endMinute })
    .from(openingHours)
    .where(eq(openingHours.businessId, businessId))
    .orderBy(asc(openingHours.weekday), asc(openingHours.startMinute));
}

export async function getUpcomingExceptions(business: Pick<Business, "id" | "timezone">) {
  return db
    .select({
      id: scheduleExceptions.id,
      date: scheduleExceptions.date,
      startMinute: scheduleExceptions.startMinute,
      endMinute: scheduleExceptions.endMinute,
      note: scheduleExceptions.note,
    })
    .from(scheduleExceptions)
    .where(and(eq(scheduleExceptions.businessId, business.id), gte(scheduleExceptions.date, todayStr(business.timezone))))
    .orderBy(asc(scheduleExceptions.date), asc(scheduleExceptions.startMinute));
}

export async function getUserVehicles(userId: string) {
  return db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(desc(vehicles.lastUsedAt)).limit(10);
}

export type DirectoryItem = Pick<Business, "id" | "slug" | "name" | "description" | "address" | "city" | "logoUrl" | "coverUrl" | "lat" | "lng"> & {
  distanceKm: number | null;
  minPrice: number | null;
};

/** Directorio público: lavaderos activos, ordenados por distancia si hay ubicación. */
export async function searchDirectory(params: { q?: string; lat?: number; lng?: number; limit?: number }): Promise<DirectoryItem[]> {
  const { q, lat, lng, limit = 48 } = params;
  const hasGeo = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
  // Haversine en SQL (km). Sin PostGIS para mantenerlo simple y portable.
  const distance = hasGeo
    ? sql<number | null>`case when ${businesses.lat} is null or ${businesses.lng} is null then null else
        6371 * 2 * asin(sqrt(power(sin(radians(${businesses.lat} - ${lat}) / 2), 2) +
        cos(radians(${lat})) * cos(radians(${businesses.lat})) * power(sin(radians(${businesses.lng} - ${lng}) / 2), 2))) end`
    : sql<number | null>`null`;
  // Nombres calificados a mano: dentro de un select, Drizzle no prefija la tabla y "id" sería ambiguo.
  const minPrice = sql<number | null>`(select min(sp.price) from service_prices sp join services s on s.id = sp.service_id where s.business_id = "businesses"."id" and s.active)`;
  const term = q?.trim();
  const rows = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      description: businesses.description,
      address: businesses.address,
      city: businesses.city,
      logoUrl: businesses.logoUrl,
      coverUrl: businesses.coverUrl,
      lat: businesses.lat,
      lng: businesses.lng,
      distanceKm: distance,
      minPrice,
    })
    .from(businesses)
    .where(
      and(
        eq(businesses.status, "active"),
        term
          ? sql`(unaccent_lower(${businesses.name}) like '%' || unaccent_lower(${term}) || '%' or unaccent_lower(coalesce(${businesses.city}, '')) like '%' || unaccent_lower(${term}) || '%' or unaccent_lower(coalesce(${businesses.address}, '')) like '%' || unaccent_lower(${term}) || '%')`
          : undefined,
      ),
    )
    .orderBy(hasGeo ? sql`${distance} asc nulls last` : asc(businesses.name))
    .limit(limit);
  return rows.map((r) => ({ ...r, distanceKm: r.distanceKm === null ? null : Number(r.distanceKm), minPrice: r.minPrice === null ? null : Number(r.minPrice) }));
}

export async function getCustomerBookings(userId: string) {
  return db
    .select({ booking: bookings, business: { name: businesses.name, slug: businesses.slug, timezone: businesses.timezone, address: businesses.address, city: businesses.city } })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(eq(bookings.customerId, userId))
    .orderBy(desc(bookings.startsAt))
    .limit(100);
}
