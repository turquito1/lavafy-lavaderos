import type { Metadata } from "next";
import { Suspense } from "react";
import { and, eq, gte, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, openingHours, scheduleExceptions } from "@/db/schema";
import { PageSkeleton } from "@/components/ui/Spinner";
import { AgendaView } from "@/components/panel/AgendaView";
import { SetupChecklist } from "@/components/panel/SetupChecklist";
import { requireBusiness } from "@/server/session";
import { getCatalog } from "@/server/queries";
import { listBusinessBookingsBetween } from "@/server/bookings";
import { getOpenIntervals } from "@/lib/availability";
import { dayRangeUtc, isDateStr, todayStr } from "@/lib/time";
import { toBookingDTO } from "@/lib/booking-dto";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage({ searchParams }: PageProps<"/panel/agenda">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/panel/agenda">["searchParams"] }) {
  const { business } = await requireBusiness();
  const sp = await searchParams;
  const today = todayStr(business.timezone);
  const date = typeof sp.fecha === "string" && isDateStr(sp.fecha) ? sp.fecha : today;
  const { from, to } = dayRangeUtc(date, business.timezone);

  const [dayBookings, catalog, weekly, exceptions, [{ pendingOther }]] = await Promise.all([
    listBusinessBookingsBetween(business.id, from, to),
    getCatalog(business.id),
    db.select().from(openingHours).where(eq(openingHours.businessId, business.id)),
    db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.businessId, business.id), eq(scheduleExceptions.date, date))),
    db
      .select({ pendingOther: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.businessId, business.id), eq(bookings.status, "pending"), gte(bookings.endsAt, new Date()), or(lt(bookings.startsAt, from), gte(bookings.startsAt, to)))),
  ]);

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-8 md:pt-8 [&:empty]:hidden">
        <SetupChecklist />
      </div>
      <AgendaView
        business={{ timezone: business.timezone, slotIntervalMinutes: business.slotIntervalMinutes, capacity: business.capacity, name: business.name }}
        date={date}
        today={today}
        bookings={dayBookings.map(toBookingDTO)}
        services={catalog}
        open={getOpenIntervals(date, weekly, exceptions)}
        pendingOtherDays={pendingOther}
      />
    </>
  );
}
