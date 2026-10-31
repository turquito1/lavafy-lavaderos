"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/server/session";
import { getBusinessBySlug } from "@/server/queries";
import { cancelBooking, createOnlineBooking, rescheduleBooking } from "@/server/bookings";
import { notifyBookingCancelled, notifyBookingCreated, notifyBookingRescheduled } from "@/server/notifications";
import { firstError, onlineBookingSchema, type OnlineBookingPayload } from "@/lib/validation";
import { fail, handleError, ok, type ActionResult } from "./result";

/** El cliente confirma un turno desde la página pública del lavadero. */
export async function createBookingAction(payload: OnlineBookingPayload): Promise<ActionResult<{ code: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("Iniciá sesión con Google para confirmar el turno.", "UNAUTHENTICATED");
  const parsed = onlineBookingSchema.safeParse(payload);
  if (!parsed.success) return fail(firstError(parsed.error), "INVALID");
  const input = parsed.data;
  const business = await getBusinessBySlug(input.slug);
  if (!business) return fail("Lavadero no encontrado.", "NOT_FOUND");
  try {
    const { booking } = await createOnlineBooking({
      businessId: business.id,
      customerId: user.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: user.email,
      serviceId: input.serviceId,
      vehicleType: input.vehicleType,
      plate: input.plate,
      brand: input.brand,
      model: input.model,
      startsAt: new Date(input.startsAt),
      notes: input.notes,
    });
    after(() => notifyBookingCreated(booking, business));
    return ok({ code: booking.code });
  } catch (err) {
    return handleError(err);
  }
}

const idSchema = z.uuid();

export async function cancelMyBookingAction(bookingId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Iniciá sesión para continuar.", "UNAUTHENTICATED");
  if (!idSchema.safeParse(bookingId).success) return fail("Turno inválido.");
  try {
    const { booking, business } = await cancelBooking({ bookingId, actor: { kind: "customer", userId: user.id } });
    after(() => notifyBookingCancelled(booking, business));
    refresh();
    return ok(undefined);
  } catch (err) {
    return handleError(err);
  }
}

export async function rescheduleMyBookingAction(bookingId: string, startsAt: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Iniciá sesión para continuar.", "UNAUTHENTICATED");
  if (!idSchema.safeParse(bookingId).success || !z.iso.datetime().safeParse(startsAt).success) return fail("Datos inválidos.");
  try {
    const { booking, business } = await rescheduleBooking({ bookingId, startsAt: new Date(startsAt), actor: { kind: "customer", userId: user.id } });
    after(() => notifyBookingRescheduled(booking, business, "customer"));
    refresh();
    return ok(undefined);
  } catch (err) {
    return handleError(err);
  }
}
