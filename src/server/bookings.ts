/**
 * Lógica de negocio de turnos. Todo lo que crea o mueve un turno pasa por acá, dentro de una
 * transacción con un lock por lavadero (pg_advisory_xact_lock): así dos personas que reservan
 * el mismo horario al mismo tiempo nunca superan la capacidad.
 *
 * Estas funciones NO verifican sesión: lo hacen las server actions que las llaman.
 */
import "server-only";
import { and, asc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingEvents,
  bookings,
  businesses,
  openingHours,
  scheduleExceptions,
  servicePrices,
  services,
  users,
  vehicles,
  type Booking,
  type BookingSource,
  type BookingStatus,
  type Business,
  type VehicleType,
} from "@/db/schema";
import { computeSlots, getOpenIntervals, isSlotBookable, peakOverlap, bookableDates, type BusyRange, type Slot } from "@/lib/availability";
import { dayRangeUtc, utcToZoned } from "@/lib/time";
import { STATUS_TRANSITIONS } from "@/lib/constants";

type Executor = typeof db | Tx;

export type BookingErrorCode =
  | "NOT_FOUND"
  | "BUSINESS_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_DATE"
  | "SLOT_TAKEN"
  | "OUTSIDE_HOURS"
  | "CAPACITY"
  | "TOO_LATE"
  | "INVALID_STATUS";

export class BookingError extends Error {
  constructor(
    public code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

// ─── Lecturas ─────────────────────────────────────────────────────────────────

async function lockBusiness(tx: Tx, businessId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${businessId}, 0))`);
}

async function loadSchedule(ex: Executor, businessId: string, dateStr: string) {
  const [weekly, exceptions] = await Promise.all([
    ex
      .select({ weekday: openingHours.weekday, startMinute: openingHours.startMinute, endMinute: openingHours.endMinute })
      .from(openingHours)
      .where(eq(openingHours.businessId, businessId)),
    ex
      .select({ date: scheduleExceptions.date, startMinute: scheduleExceptions.startMinute, endMinute: scheduleExceptions.endMinute })
      .from(scheduleExceptions)
      .where(and(eq(scheduleExceptions.businessId, businessId), eq(scheduleExceptions.date, dateStr))),
  ]);
  return getOpenIntervals(dateStr, weekly, exceptions);
}

async function loadBusy(ex: Executor, businessId: string, from: Date, to: Date, excludeBookingId?: string): Promise<BusyRange[]> {
  const conditions = [
    eq(bookings.businessId, businessId),
    inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
    lt(bookings.startsAt, to),
    gt(bookings.endsAt, from),
  ];
  if (excludeBookingId) conditions.push(ne(bookings.id, excludeBookingId));
  return ex.select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt }).from(bookings).where(and(...conditions));
}

export async function getServiceOption(ex: Executor, businessId: string, serviceId: string, vehicleType: VehicleType) {
  const [row] = await ex
    .select({
      serviceId: services.id,
      serviceName: services.name,
      price: servicePrices.price,
      durationMinutes: servicePrices.durationMinutes,
    })
    .from(services)
    .innerJoin(servicePrices, eq(servicePrices.serviceId, services.id))
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.businessId, businessId),
        eq(services.active, true),
        eq(servicePrices.vehicleType, vehicleType),
      ),
    );
  return row ?? null;
}

/** Horarios disponibles para reservar online un servicio en una fecha. */
export async function getAvailableSlots(params: {
  business: Pick<Business, "id" | "timezone" | "capacity" | "slotIntervalMinutes" | "minLeadMinutes" | "maxDaysAhead">;
  durationMinutes: number;
  dateStr: string;
  excludeBookingId?: string;
  now?: Date;
}): Promise<Slot[]> {
  const { business, durationMinutes, dateStr, excludeBookingId, now = new Date() } = params;
  if (!bookableDates(business.timezone, business.maxDaysAhead, now).includes(dateStr)) return [];
  const open = await loadSchedule(db, business.id, dateStr);
  if (open.length === 0) return [];
  const { from, to } = dayRangeUtc(dateStr, business.timezone);
  const busy = await loadBusy(db, business.id, from, new Date(to.getTime() + durationMinutes * 60_000), excludeBookingId);
  return computeSlots({
    dateStr,
    timezone: business.timezone,
    open,
    intervalMinutes: business.slotIntervalMinutes,
    durationMinutes,
    capacity: business.capacity,
    busy,
    now,
    minLeadMinutes: business.minLeadMinutes,
  });
}

/** Valida que un horario sea reservable online (dentro de la transacción, con el lock tomado). */
async function assertOnlineSlot(tx: Tx, business: Business, startsAt: Date, durationMinutes: number, excludeBookingId?: string) {
  const now = new Date();
  const { dateStr } = utcToZoned(startsAt, business.timezone);
  if (!bookableDates(business.timezone, business.maxDaysAhead, now).includes(dateStr)) {
    throw new BookingError("INVALID_DATE", "Esa fecha no está disponible para reservar.");
  }
  const open = await loadSchedule(tx, business.id, dateStr);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const busy = await loadBusy(tx, business.id, startsAt, endsAt, excludeBookingId);
  const ok = isSlotBookable({
    startsAt,
    timezone: business.timezone,
    open,
    intervalMinutes: business.slotIntervalMinutes,
    durationMinutes,
    capacity: business.capacity,
    busy,
    now,
    minLeadMinutes: business.minLeadMinutes,
  });
  if (!ok) {
    const free = business.capacity - peakOverlap(busy, startsAt, endsAt) > 0;
    throw free
      ? new BookingError("OUTSIDE_HOURS", "Ese horario ya no está disponible. Elegí otro.")
      : new BookingError("SLOT_TAKEN", "Uy, alguien reservó ese horario recién. Elegí otro.");
  }
}

async function assertCapacity(tx: Tx, business: Business, startsAt: Date, endsAt: Date, excludeBookingId?: string) {
  const busy = await loadBusy(tx, business.id, startsAt, endsAt, excludeBookingId);
  if (peakOverlap(busy, startsAt, endsAt) >= business.capacity) {
    throw new BookingError("CAPACITY", `En ese horario ya tenés ${business.capacity} auto(s) a la vez (tu capacidad máxima).`);
  }
}

// ─── Código corto ─────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I

function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

async function insertBooking(tx: Tx, values: Omit<typeof bookings.$inferInsert, "code">): Promise<Booking> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const [exists] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.code, code));
    if (exists) continue;
    const [row] = await tx
      .insert(bookings)
      .values({ ...values, code })
      .returning();
    return row;
  }
  throw new Error("No se pudo generar un código de turno único");
}

async function logEvent(tx: Tx, bookingId: string, type: string, actorUserId: string | null, data?: Record<string, unknown>) {
  await tx.insert(bookingEvents).values({ bookingId, type, actorUserId, data });
}

async function getBusinessForUpdate(tx: Tx, businessId: string): Promise<Business> {
  const [business] = await tx.select().from(businesses).where(eq(businesses.id, businessId));
  if (!business) throw new BookingError("NOT_FOUND", "Lavadero no encontrado.");
  return business;
}

// ─── Crear turnos ─────────────────────────────────────────────────────────────

export type OnlineBookingInput = {
  businessId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  serviceId: string;
  vehicleType: VehicleType;
  plate: string;
  brand?: string | null;
  model?: string | null;
  startsAt: Date;
  notes?: string | null;
};

export async function createOnlineBooking(input: OnlineBookingInput): Promise<{ booking: Booking; business: Business }> {
  return db.transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const business = await getBusinessForUpdate(tx, input.businessId);
    if (business.status !== "active") throw new BookingError("BUSINESS_UNAVAILABLE", "Este lavadero no está tomando turnos online.");

    const option = await getServiceOption(tx, business.id, input.serviceId, input.vehicleType);
    if (!option) throw new BookingError("SERVICE_UNAVAILABLE", "Ese servicio no está disponible para tu vehículo.");

    await assertOnlineSlot(tx, business, input.startsAt, option.durationMinutes);

    // Guardamos/actualizamos el vehículo y el teléfono del cliente para la próxima.
    const [vehicle] = await tx
      .insert(vehicles)
      .values({ userId: input.customerId, plate: input.plate, brand: input.brand, model: input.model, type: input.vehicleType })
      .onConflictDoUpdate({
        target: [vehicles.userId, vehicles.plate],
        set: { brand: input.brand, model: input.model, type: input.vehicleType, lastUsedAt: new Date() },
      })
      .returning({ id: vehicles.id });
    await tx.update(users).set({ phone: input.customerPhone, name: input.customerName }).where(eq(users.id, input.customerId));

    const booking = await insertBooking(tx, {
      businessId: business.id,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      serviceId: option.serviceId,
      serviceName: option.serviceName,
      price: option.price,
      durationMinutes: option.durationMinutes,
      vehicleId: vehicle.id,
      vehicleType: input.vehicleType,
      vehiclePlate: input.plate,
      vehicleBrand: input.brand,
      vehicleModel: input.model,
      startsAt: input.startsAt,
      endsAt: new Date(input.startsAt.getTime() + option.durationMinutes * 60_000),
      status: business.requiresApproval ? "pending" : "confirmed",
      source: "online",
      notes: input.notes,
    });
    await logEvent(tx, booking.id, "created", input.customerId, { source: "online" });
    return { booking, business };
  });
}

export type ManualBookingInput = {
  businessId: string;
  actorUserId: string;
  source: Extract<BookingSource, "manual" | "walk_in">;
  serviceId: string;
  vehicleType: VehicleType;
  startsAt: Date;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
  /** Permite superar la capacidad (el lavadero decide). */
  force?: boolean;
};

export async function createManualBooking(input: ManualBookingInput): Promise<Booking> {
  return db.transaction(async (tx) => {
    await lockBusiness(tx, input.businessId);
    const business = await getBusinessForUpdate(tx, input.businessId);
    const option = await getServiceOption(tx, business.id, input.serviceId, input.vehicleType);
    if (!option) throw new BookingError("SERVICE_UNAVAILABLE", "Ese servicio no tiene precio para ese tipo de vehículo.");
    const endsAt = new Date(input.startsAt.getTime() + option.durationMinutes * 60_000);
    if (!input.force) await assertCapacity(tx, business, input.startsAt, endsAt);

    const booking = await insertBooking(tx, {
      businessId: business.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      serviceId: option.serviceId,
      serviceName: option.serviceName,
      price: option.price,
      durationMinutes: option.durationMinutes,
      vehicleType: input.vehicleType,
      vehiclePlate: input.plate,
      vehicleBrand: input.brand,
      vehicleModel: input.model,
      startsAt: input.startsAt,
      endsAt,
      status: input.source === "walk_in" ? "in_progress" : "confirmed",
      source: input.source,
      notes: input.notes,
    });
    await logEvent(tx, booking.id, "created", input.actorUserId, { source: input.source, forced: !!input.force });
    return booking;
  });
}

// ─── Modificar turnos ─────────────────────────────────────────────────────────

export type Actor = { kind: "customer"; userId: string } | { kind: "business"; userId: string; businessId: string };

async function getBookingForActor(tx: Tx, bookingId: string, actor: Actor): Promise<Booking> {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new BookingError("NOT_FOUND", "Turno no encontrado.");
  const allowed = actor.kind === "customer" ? booking.customerId === actor.userId : booking.businessId === actor.businessId;
  if (!allowed) throw new BookingError("NOT_FOUND", "Turno no encontrado.");
  return booking;
}

function assertCustomerWindow(booking: Booking, business: Business) {
  const limit = booking.startsAt.getTime() - business.cancelWindowMinutes * 60_000;
  if (Date.now() > limit) {
    throw new BookingError(
      "TOO_LATE",
      `Solo podés cambiar el turno hasta ${business.cancelWindowMinutes >= 60 ? `${business.cancelWindowMinutes / 60} h` : `${business.cancelWindowMinutes} min`} antes. Escribile al lavadero.`,
    );
  }
}

/** Puede el cliente cancelar/reprogramar ahora mismo? (para mostrar u ocultar botones) */
export function customerCanModify(booking: Pick<Booking, "status" | "startsAt">, business: Pick<Business, "cancelWindowMinutes">, now = new Date()) {
  return (
    (booking.status === "pending" || booking.status === "confirmed") &&
    now.getTime() <= booking.startsAt.getTime() - business.cancelWindowMinutes * 60_000
  );
}

export async function rescheduleBooking(params: { bookingId: string; startsAt: Date; actor: Actor; force?: boolean }) {
  const { bookingId, startsAt, actor, force } = params;
  return db.transaction(async (tx) => {
    const [peek] = await tx.select({ businessId: bookings.businessId }).from(bookings).where(eq(bookings.id, bookingId));
    if (!peek) throw new BookingError("NOT_FOUND", "Turno no encontrado.");
    await lockBusiness(tx, peek.businessId);
    const booking = await getBookingForActor(tx, bookingId, actor);
    const business = await getBusinessForUpdate(tx, booking.businessId);
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new BookingError("INVALID_STATUS", "Este turno ya no se puede reprogramar.");
    }
    const endsAt = new Date(startsAt.getTime() + booking.durationMinutes * 60_000);
    if (actor.kind === "customer") {
      assertCustomerWindow(booking, business);
      await assertOnlineSlot(tx, business, startsAt, booking.durationMinutes, booking.id);
    } else if (!force) {
      await assertCapacity(tx, business, startsAt, endsAt, booking.id);
    }
    const [updated] = await tx
      .update(bookings)
      .set({ startsAt, endsAt, reminderSentAt: null })
      .where(eq(bookings.id, booking.id))
      .returning();
    await logEvent(tx, booking.id, "rescheduled", actor.userId, {
      by: actor.kind,
      from: booking.startsAt.toISOString(),
      to: startsAt.toISOString(),
    });
    return { before: booking, booking: updated, business };
  });
}

export async function cancelBooking(params: { bookingId: string; actor: Actor; reason?: string | null }) {
  const { bookingId, actor, reason } = params;
  return db.transaction(async (tx) => {
    const booking = await getBookingForActor(tx, bookingId, actor);
    const business = await getBusinessForUpdate(tx, booking.businessId);
    const cancellable: BookingStatus[] = actor.kind === "customer" ? ["pending", "confirmed"] : ["pending", "confirmed", "in_progress", "ready"];
    if (!cancellable.includes(booking.status)) throw new BookingError("INVALID_STATUS", "Este turno ya no se puede cancelar.");
    if (actor.kind === "customer") assertCustomerWindow(booking, business);
    const [updated] = await tx
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: actor.kind, cancelReason: reason || null })
      .where(eq(bookings.id, booking.id))
      .returning();
    await logEvent(tx, booking.id, "cancelled", actor.userId, { by: actor.kind, reason });
    return { booking: updated, business };
  });
}

export async function setBookingStatus(params: { bookingId: string; status: BookingStatus; actor: Extract<Actor, { kind: "business" }> }) {
  const { bookingId, status, actor } = params;
  if (status === "cancelled") return cancelBooking({ bookingId, actor });
  return db.transaction(async (tx) => {
    const booking = await getBookingForActor(tx, bookingId, actor);
    const business = await getBusinessForUpdate(tx, booking.businessId);
    if (!STATUS_TRANSITIONS[booking.status].includes(status)) {
      throw new BookingError("INVALID_STATUS", "Ese cambio de estado no es válido.");
    }
    const [updated] = await tx.update(bookings).set({ status }).where(eq(bookings.id, booking.id)).returning();
    await logEvent(tx, booking.id, "status_changed", actor.userId, { from: booking.status, to: status });
    return { booking: updated, business, previousStatus: booking.status };
  });
}

// ─── Consultas para pantallas ─────────────────────────────────────────────────

export async function listBusinessBookingsBetween(businessId: string, from: Date, to: Date) {
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.businessId, businessId), lt(bookings.startsAt, to), gt(bookings.endsAt, from)))
    .orderBy(asc(bookings.startsAt));
}
