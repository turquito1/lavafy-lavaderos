import { type NextRequest } from "next/server";
import { getAvailableSlots, getServiceOption } from "@/server/bookings";
import { getBusinessBySlug } from "@/server/queries";
import { db } from "@/db";
import { isDateStr } from "@/lib/time";
import { vehicleTypeSchema } from "@/lib/validation";
import { z } from "zod";

const querySchema = z.object({
  slug: z.string().min(1),
  service: z.uuid(),
  vehicle: vehicleTypeSchema,
  date: z.string().refine(isDateStr),
  exclude: z.uuid().optional(),
});

/** GET /api/slots?slug=&service=&vehicle=&date=YYYY-MM-DD[&exclude=bookingId] */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  const { slug, service, vehicle, date, exclude } = parsed.data;
  const business = await getBusinessBySlug(slug);
  if (!business || business.status === "suspended") return Response.json({ error: "Lavadero no encontrado" }, { status: 404 });
  const option = await getServiceOption(db, business.id, service, vehicle);
  if (!option) return Response.json({ slots: [] });
  const slots = await getAvailableSlots({ business, durationMinutes: option.durationMinutes, dateStr: date, excludeBookingId: exclude });
  return Response.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
