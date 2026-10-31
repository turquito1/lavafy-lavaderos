"use server";

/**
 * Server actions del panel del lavadero. Todas validan sesión + pertenencia al lavadero
 * (requireBusiness) antes de tocar datos.
 */
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  bookings,
  businessMembers,
  businessPhotos,
  businesses,
  openingHours,
  scheduleExceptions,
  servicePrices,
  services,
  type BookingStatus,
} from "@/db/schema";
import { BUSINESS_COOKIE, assertBusinessMember, requireBusiness, requireUser } from "@/server/session";
import { cancelBooking, createManualBooking, rescheduleBooking, setBookingStatus } from "@/server/bookings";
import {
  notifyBookingCancelled,
  notifyBookingConfirmed,
  notifyBookingReady,
  notifyBookingRescheduled,
} from "@/server/notifications";
import { MAX_PHOTOS, RESERVED_SLUGS } from "@/lib/constants";
import { isDateStr } from "@/lib/time";
import { slugify } from "@/lib/format";
import { firstError, manualBookingSchema, vehicleTypeSchema, type ManualBookingPayload } from "@/lib/validation";
import { fail, handleError, ok, type ActionResult } from "./result";
import { deleteImage, saveImage, StorageError } from "@/server/storage";

// ─── Onboarding ───────────────────────────────────────────────────────────────

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El link tiene que tener al menos 3 caracteres")
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo letras, números y guiones")
  .refine((s) => !RESERVED_SLUGS.has(s), "Ese link está reservado, probá otro");

const optional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const newBusinessSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del lavadero").max(80),
  slug: slugSchema,
  phone: optional(30),
  address: z.string().trim().min(3, "Ingresá la dirección").max(160),
  city: z.string().trim().min(2, "Ingresá la ciudad").max(80),
  province: optional(80),
  capacity: z.coerce.number().int().min(1).max(50),
});

export async function checkSlugAction(slug: string): Promise<{ available: boolean; error?: string }> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { available: false, error: firstError(parsed.error) };
  const [exists] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, parsed.data));
  return exists ? { available: false, error: "Ese link ya está en uso" } : { available: true };
}

export async function createBusinessAction(_: unknown, formData: FormData): Promise<ActionResult> {
  const user = await requireUser("/panel/nuevo");
  const parsed = newBusinessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const data = parsed.data;
  const [taken] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, data.slug));
  if (taken) return fail("Ese link ya está en uso, elegí otro.");

  const businessId = await db.transaction(async (tx) => {
    const [b] = await tx
      .insert(businesses)
      .values({
        name: data.name,
        slug: data.slug,
        phone: data.phone,
        whatsapp: data.phone,
        email: user.email,
        address: data.address,
        city: data.city,
        province: data.province,
        capacity: data.capacity,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 3600_000),
      })
      .returning({ id: businesses.id });
    await tx.insert(businessMembers).values({ businessId: b.id, userId: user.id, role: "owner" });
    // Horario sugerido para arrancar: lunes a viernes 9–19, sábado 9–13.
    await tx.insert(openingHours).values([
      ...[1, 2, 3, 4, 5].map((weekday) => ({ businessId: b.id, weekday, startMinute: 540, endMinute: 1140 })),
      { businessId: b.id, weekday: 6, startMinute: 540, endMinute: 780 },
    ]);
    return b.id;
  });
  (await cookies()).set(BUSINESS_COOKIE, businessId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/panel/servicios?bienvenida=1");
}

export async function suggestSlugAction(name: string): Promise<string> {
  const base = slugify(name) || "lavadero";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate) || candidate.length < 3) continue;
    const [exists] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, candidate));
    if (!exists) return candidate;
  }
  return `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function selectBusinessAction(businessId: string) {
  const user = await requireUser("/panel");
  await assertBusinessMember(user.id, businessId);
  (await cookies()).set(BUSINESS_COOKIE, businessId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/panel/agenda");
}

// ─── Configuración ────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  description: optional(600),
  phone: optional(30),
  whatsapp: optional(30),
  instagram: optional(60),
  email: z.union([z.email("Email inválido"), z.literal("")]).optional().transform((v) => v || null),
});

export async function updateProfileAction(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  if (parsed.data.slug !== business.slug) {
    const [taken] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, parsed.data.slug));
    if (taken) return fail("Ese link ya está en uso.");
  }
  await db.update(businesses).set(parsed.data).where(eq(businesses.id, business.id));
  refresh();
  return ok(undefined);
}

const locationSchema = z.object({
  address: z.string().trim().min(3, "Ingresá la dirección").max(160),
  city: z.string().trim().min(2, "Ingresá la ciudad").max(80),
  province: optional(80),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export async function updateLocationAction(input: z.input<typeof locationSchema>): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  await db.update(businesses).set(parsed.data).where(eq(businesses.id, business.id));
  refresh();
  return ok(undefined);
}

const rulesSchema = z.object({
  capacity: z.number().int().min(1, "Mínimo 1 auto").max(50),
  slotIntervalMinutes: z.number().int().min(5).max(240),
  minLeadMinutes: z.number().int().min(0).max(7 * 24 * 60),
  maxDaysAhead: z.number().int().min(1).max(180),
  cancelWindowMinutes: z.number().int().min(60, "El mínimo es 1 hora").max(7 * 24 * 60),
  requiresApproval: z.boolean(),
});

export async function updateRulesAction(input: z.input<typeof rulesSchema>): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  await db.update(businesses).set(parsed.data).where(eq(businesses.id, business.id));
  refresh();
  return ok(undefined);
}

export async function setPublishedAction(published: boolean): Promise<ActionResult> {
  const { business } = await requireBusiness();
  if (business.status === "suspended") return fail("Tu lavadero está suspendido. Escribinos para reactivarlo.");
  if (published) {
    const [{ count: priced }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(services)
      .innerJoin(servicePrices, eq(servicePrices.serviceId, services.id))
      .where(and(eq(services.businessId, business.id), eq(services.active, true)));
    if (!priced) return fail("Antes de publicar, cargá al menos un servicio con precio.");
    const [{ count: hours }] = await db.select({ count: sql<number>`count(*)::int` }).from(openingHours).where(eq(openingHours.businessId, business.id));
    if (!hours) return fail("Antes de publicar, configurá tus horarios.");
  }
  await db.update(businesses).set({ status: published ? "active" : "draft" }).where(eq(businesses.id, business.id));
  refresh();
  return ok(undefined);
}

export async function uploadImageAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const { business } = await requireBusiness();
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (kind !== "logo" && kind !== "cover") return fail("Tipo inválido");
  try {
    const url = await saveImage(`businesses/${business.id}/${kind}`, file as File);
    await db
      .update(businesses)
      .set(kind === "logo" ? { logoUrl: url } : { coverUrl: url })
      .where(eq(businesses.id, business.id));
    after(() => deleteImage(kind === "logo" ? business.logoUrl : business.coverUrl));
    refresh();
    return ok({ url });
  } catch (err) {
    if (err instanceof StorageError) return fail(err.message);
    return handleError(err);
  }
}

export async function removeImageAction(kind: "logo" | "cover"): Promise<ActionResult> {
  const { business } = await requireBusiness();
  if (kind !== "logo" && kind !== "cover") return fail("Tipo inválido");
  await db
    .update(businesses)
    .set(kind === "logo" ? { logoUrl: null } : { coverUrl: null })
    .where(eq(businesses.id, business.id));
  after(() => deleteImage(kind === "logo" ? business.logoUrl : business.coverUrl));
  refresh();
  return ok(undefined);
}

// ─── Galería de fotos ─────────────────────────────────────────────────────────

export async function uploadPhotoAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { business } = await requireBusiness();
  const width = Number(formData.get("width")) || null;
  const height = Number(formData.get("height")) || null;
  try {
    const [{ count, max }] = await db
      .select({ count: sql<number>`count(*)::int`, max: sql<number>`coalesce(max(${businessPhotos.sortOrder}), -1)::int` })
      .from(businessPhotos)
      .where(eq(businessPhotos.businessId, business.id));
    if (count >= MAX_PHOTOS) return fail(`Podés tener hasta ${MAX_PHOTOS} fotos. Borrá alguna para subir otra.`);
    const url = await saveImage(`businesses/${business.id}/fotos/foto`, formData.get("file") as File);
    const [row] = await db
      .insert(businessPhotos)
      .values({ businessId: business.id, url, width, height, sortOrder: max + 1 })
      .returning({ id: businessPhotos.id });
    refresh();
    return ok({ id: row.id });
  } catch (err) {
    if (err instanceof StorageError) return fail(err.message);
    return handleError(err);
  }
}

export async function deletePhotoAction(id: string): Promise<ActionResult> {
  const { business } = await requireBusiness();
  if (!z.uuid().safeParse(id).success) return fail("Foto inválida");
  const [row] = await db
    .delete(businessPhotos)
    .where(and(eq(businessPhotos.id, id), eq(businessPhotos.businessId, business.id)))
    .returning({ url: businessPhotos.url });
  if (row) after(() => deleteImage(row.url));
  refresh();
  return ok(undefined);
}

export async function movePhotoAction(id: string, direction: -1 | 1): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const list = await db
    .select({ id: businessPhotos.id })
    .from(businessPhotos)
    .where(eq(businessPhotos.businessId, business.id))
    .orderBy(businessPhotos.sortOrder, businessPhotos.createdAt);
  const i = list.findIndex((p) => p.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return ok(undefined);
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction(async (tx) => {
    for (const [index, p] of list.entries()) await tx.update(businessPhotos).set({ sortOrder: index }).where(eq(businessPhotos.id, p.id));
  });
  refresh();
  return ok(undefined);
}

// ─── Horarios ─────────────────────────────────────────────────────────────────

const rangeSchema = z
  .object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1440), endMinute: z.number().int().min(0).max(1440) })
  .refine((r) => r.startMinute < r.endMinute, "Cada horario tiene que terminar después de empezar");

export async function saveWeeklyHoursAction(ranges: z.input<typeof rangeSchema>[]): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const parsed = z.array(rangeSchema).max(50).safeParse(ranges);
  if (!parsed.success) return fail(firstError(parsed.error));
  for (let wd = 0; wd <= 6; wd++) {
    const day = parsed.data.filter((r) => r.weekday === wd).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < day.length; i++) {
      if (day[i].startMinute < day[i - 1].endMinute) return fail("Hay horarios que se pisan en el mismo día.");
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(openingHours).where(eq(openingHours.businessId, business.id));
    if (parsed.data.length) await tx.insert(openingHours).values(parsed.data.map((r) => ({ ...r, businessId: business.id })));
  });
  refresh();
  return ok(undefined);
}

const exceptionSchema = z
  .object({
    date: z.string().refine(isDateStr, "Fecha inválida"),
    closed: z.boolean(),
    startMinute: z.number().int().min(0).max(1440).nullable(),
    endMinute: z.number().int().min(0).max(1440).nullable(),
    note: optional(80),
  })
  .refine((e) => e.closed || (e.startMinute !== null && e.endMinute !== null && e.startMinute < e.endMinute), "Revisá el horario especial");

export async function addExceptionAction(input: z.input<typeof exceptionSchema>): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const e = parsed.data;
  await db.transaction(async (tx) => {
    // Un cierre total reemplaza cualquier otra excepción de ese día; un horario especial reemplaza un cierre.
    if (e.closed) {
      await tx.delete(scheduleExceptions).where(and(eq(scheduleExceptions.businessId, business.id), eq(scheduleExceptions.date, e.date)));
    } else {
      await tx
        .delete(scheduleExceptions)
        .where(and(eq(scheduleExceptions.businessId, business.id), eq(scheduleExceptions.date, e.date), sql`${scheduleExceptions.startMinute} is null`));
    }
    await tx.insert(scheduleExceptions).values({
      businessId: business.id,
      date: e.date,
      startMinute: e.closed ? null : e.startMinute,
      endMinute: e.closed ? null : e.endMinute,
      note: e.note,
    });
  });
  refresh();
  return ok(undefined);
}

export async function deleteExceptionAction(id: string): Promise<ActionResult> {
  const { business } = await requireBusiness();
  await db.delete(scheduleExceptions).where(and(eq(scheduleExceptions.id, id), eq(scheduleExceptions.businessId, business.id)));
  refresh();
  return ok(undefined);
}

// ─── Servicios ────────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Ingresá el nombre del servicio").max(60),
  description: optional(240),
  active: z.boolean(),
  prices: z
    .array(
      z.object({
        vehicleType: vehicleTypeSchema,
        price: z.number().int("El precio tiene que ser un número entero").min(0).max(10_000_000),
        durationMinutes: z.number().int().min(5, "La duración mínima es 5 min").max(720),
      }),
    )
    .min(1, "Activá al menos un tipo de vehículo con su precio"),
});

export async function saveServiceAction(input: z.input<typeof serviceSchema>): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, prices, ...data } = parsed.data;
  await db.transaction(async (tx) => {
    let serviceId = id;
    if (serviceId) {
      const [updated] = await tx
        .update(services)
        .set(data)
        .where(and(eq(services.id, serviceId), eq(services.businessId, business.id)))
        .returning({ id: services.id });
      if (!updated) throw new Error("Servicio no encontrado");
      await tx.delete(servicePrices).where(eq(servicePrices.serviceId, serviceId));
    } else {
      const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${services.sortOrder}), -1)::int` }).from(services).where(eq(services.businessId, business.id));
      const [created] = await tx
        .insert(services)
        .values({ ...data, businessId: business.id, sortOrder: max + 1 })
        .returning({ id: services.id });
      serviceId = created.id;
    }
    await tx.insert(servicePrices).values(prices.map((p) => ({ ...p, serviceId: serviceId! })));
  });
  refresh();
  return ok(undefined);
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  const { business } = await requireBusiness();
  // Los turnos guardan el nombre y precio, así que borrar el servicio no rompe el historial.
  await db.delete(services).where(and(eq(services.id, id), eq(services.businessId, business.id)));
  refresh();
  return ok(undefined);
}

export async function moveServiceAction(id: string, direction: -1 | 1): Promise<ActionResult> {
  const { business } = await requireBusiness();
  const list = await db.select({ id: services.id }).from(services).where(eq(services.businessId, business.id)).orderBy(services.sortOrder, services.createdAt);
  const i = list.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return ok(undefined);
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction(async (tx) => {
    for (const [index, s] of list.entries()) await tx.update(services).set({ sortOrder: index }).where(eq(services.id, s.id));
  });
  refresh();
  return ok(undefined);
}

// ─── Turnos ───────────────────────────────────────────────────────────────────

export async function createManualBookingAction(payload: ManualBookingPayload): Promise<ActionResult<{ id: string }>> {
  const { user, business } = await requireBusiness();
  const parsed = manualBookingSchema.safeParse(payload);
  if (!parsed.success) return fail(firstError(parsed.error));
  try {
    const booking = await createManualBooking({ ...parsed.data, businessId: business.id, actorUserId: user.id, startsAt: new Date(parsed.data.startsAt) });
    refresh();
    return ok({ id: booking.id });
  } catch (err) {
    return handleError(err);
  }
}

const statusSchema = z.enum(["pending", "confirmed", "in_progress", "ready", "completed", "cancelled", "no_show"]);

export async function setBookingStatusAction(bookingId: string, status: BookingStatus): Promise<ActionResult> {
  const { user, business } = await requireBusiness();
  if (!z.uuid().safeParse(bookingId).success || !statusSchema.safeParse(status).success) return fail("Datos inválidos");
  try {
    const result = await setBookingStatus({ bookingId, status, actor: { kind: "business", userId: user.id, businessId: business.id } });
    const updated = result.booking;
    if (status === "cancelled") after(() => notifyBookingCancelled(updated, business));
    else if ("previousStatus" in result && result.previousStatus === "pending" && status === "confirmed") after(() => notifyBookingConfirmed(updated, business));
    else if (status === "ready") after(() => notifyBookingReady(updated, business));
    refresh();
    return ok(undefined);
  } catch (err) {
    return handleError(err);
  }
}

export async function cancelBookingByBusinessAction(bookingId: string, reason: string): Promise<ActionResult> {
  const { user, business } = await requireBusiness();
  if (!z.uuid().safeParse(bookingId).success) return fail("Datos inválidos");
  try {
    const { booking } = await cancelBooking({ bookingId, reason: reason.trim().slice(0, 200) || null, actor: { kind: "business", userId: user.id, businessId: business.id } });
    after(() => notifyBookingCancelled(booking, business));
    refresh();
    return ok(undefined);
  } catch (err) {
    return handleError(err);
  }
}

export async function rescheduleByBusinessAction(bookingId: string, startsAt: string, force = false): Promise<ActionResult> {
  const { user, business } = await requireBusiness();
  if (!z.uuid().safeParse(bookingId).success || !z.iso.datetime().safeParse(startsAt).success) return fail("Datos inválidos");
  try {
    const { booking } = await rescheduleBooking({
      bookingId,
      startsAt: new Date(startsAt),
      force,
      actor: { kind: "business", userId: user.id, businessId: business.id },
    });
    after(() => notifyBookingRescheduled(booking, business, "business"));
    refresh();
    return ok(undefined);
  } catch (err) {
    return handleError(err);
  }
}

export async function updateInternalNotesAction(bookingId: string, notes: string): Promise<ActionResult> {
  const { business } = await requireBusiness();
  await db
    .update(bookings)
    .set({ internalNotes: notes.trim().slice(0, 1000) || null })
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, business.id)));
  refresh();
  return ok(undefined);
}

// ─── Super admin ──────────────────────────────────────────────────────────────

export async function adminSetBusinessStatusAction(businessId: string, status: "active" | "draft" | "suspended"): Promise<ActionResult> {
  const user = await requireUser("/admin");
  if (!user.isSuperAdmin) return fail("Sin permiso");
  await db.update(businesses).set({ status }).where(inArray(businesses.id, [businessId]));
  refresh();
  return ok(undefined);
}
