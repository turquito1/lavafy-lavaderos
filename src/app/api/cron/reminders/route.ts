import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings, businesses } from "@/db/schema";
import { notifyReminder } from "@/server/notifications";
import { dayRangeUtc, todayStr } from "@/lib/time";

/**
 * Recordatorios del día. Vercel Cron lo llama una vez por día a la mañana (ver vercel.json).
 * Manda un mail a cada cliente con turno confirmado HOY que todavía no recibió recordatorio.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const active = await db.select().from(businesses).where(eq(businesses.status, "active"));
  let sent = 0;
  for (const business of active) {
    const { from, to } = dayRangeUtc(todayStr(business.timezone), business.timezone);
    const due = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, business.id),
          inArray(bookings.status, ["confirmed"]),
          isNull(bookings.reminderSentAt),
          gte(bookings.startsAt, new Date(Math.max(from.getTime(), Date.now()))),
          lt(bookings.startsAt, to),
        ),
      );
    for (const booking of due) {
      if (!booking.customerEmail) continue;
      await notifyReminder(booking, business);
      await db.update(bookings).set({ reminderSentAt: new Date() }).where(eq(bookings.id, booking.id));
      sent++;
    }
  }
  return Response.json({ sent });
}
