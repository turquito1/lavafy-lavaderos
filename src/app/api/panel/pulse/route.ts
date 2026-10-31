import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getCurrentBusiness, getSessionUser } from "@/server/session";

/**
 * "Pulso" del panel: el navegador lo consulta cada pocos segundos para saber si hay cambios.
 * Es una consulta chica (un max() y el último turno online), así no recargamos la agenda entera
 * si no pasó nada.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
  const current = await getCurrentBusiness(user.id);
  if (!current) return Response.json({ error: "Sin lavadero" }, { status: 404 });
  const { business } = current;

  const [[stats], [latest]] = await Promise.all([
    db
      .select({
        version: sql<string | null>`max(${bookings.updatedAt})::text`,
        pending: sql<number>`count(*) filter (where ${bookings.status} = 'pending' and ${bookings.endsAt} > now())::int`,
      })
      .from(bookings)
      .where(eq(bookings.businessId, business.id)),
    db
      .select({ id: bookings.id, customerName: bookings.customerName, serviceName: bookings.serviceName, startsAt: bookings.startsAt, status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.businessId, business.id), eq(bookings.source, "online")))
      .orderBy(desc(bookings.createdAt))
      .limit(1),
  ]);

  return Response.json(
    {
      businessId: business.id,
      timezone: business.timezone,
      version: stats?.version ?? null,
      pending: stats?.pending ?? 0,
      latest: latest ? { ...latest, startsAt: latest.startsAt.toISOString() } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
