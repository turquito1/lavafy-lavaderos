import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { CalendarPlus, Car, CheckCircle2, Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { db } from "@/db";
import { bookings, businessMembers, businesses } from "@/db/schema";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageSkeleton } from "@/components/ui/Spinner";
import { BookingActions } from "@/components/booking/BookingActions";
import { requireUser } from "@/server/session";
import { customerCanModify } from "@/server/bookings";
import { getUpcomingExceptions, getWeeklyHours } from "@/server/queries";
import { formatDateLong, formatTime, ucfirst } from "@/lib/time";
import { formatDuration, formatMoney, mapsLink, whatsappLink } from "@/lib/format";
import { VEHICLE_LABEL } from "@/lib/constants";

export const metadata: Metadata = { title: "Tu turno", robots: { index: false } };

export default function BookingPage(props: PageProps<"/turno/[code]">) {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <Suspense fallback={<PageSkeleton />}>
        <BookingDetail {...props} />
      </Suspense>
    </div>
  );
}

async function BookingDetail({ params, searchParams }: PageProps<"/turno/[code]">) {
  const { code } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/turno/${code}`);
  await connection();

  const [row] = await db
    .select({ booking: bookings, business: businesses })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(eq(bookings.code, code.toUpperCase()));
  if (!row) notFound();
  const { booking, business } = row;
  const isCustomer = booking.customerId === user.id;
  const [member] = isCustomer
    ? []
    : await db.select().from(businessMembers).where(and(eq(businessMembers.businessId, business.id), eq(businessMembers.userId, user.id)));
  if (!isCustomer && !member && !user.isSuperAdmin) notFound();

  const [weekly, exceptions] = await Promise.all([getWeeklyHours(business.id), getUpcomingExceptions(business)]);
  const tz = business.timezone;
  const isNew = sp.nuevo === "1";
  const map = mapsLink(business);
  const windowLabel = business.cancelWindowMinutes >= 60 ? `${Math.round(business.cancelWindowMinutes / 60)} h` : `${business.cancelWindowMinutes} min`;
  const gcal = new URL("https://calendar.google.com/calendar/render");
  const gfmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  gcal.searchParams.set("action", "TEMPLATE");
  gcal.searchParams.set("text", `${booking.serviceName} · ${business.name}`);
  gcal.searchParams.set("dates", `${gfmt(booking.startsAt)}/${gfmt(booking.endsAt)}`);
  gcal.searchParams.set("details", `Código de turno: ${booking.code}`);
  if (business.address) gcal.searchParams.set("location", [business.address, business.city].filter(Boolean).join(", "));
  const active = ["pending", "confirmed"].includes(booking.status);

  return (
    <main className="mx-auto max-w-lg px-4 py-6 sm:py-10">
      {isNew && (
        <div className="mb-5 animate-slide-up text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="size-9 text-success" />
          </div>
          <h1 className="text-2xl font-extrabold">{booking.status === "pending" ? "¡Pedido enviado!" : "¡Turno confirmado!"}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {booking.status === "pending" ? "El lavadero lo va a revisar y te avisamos por mail." : `Te mandamos los detalles a ${booking.customerEmail ?? "tu mail"}.`}
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-line bg-primary-light px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">{ucfirst(formatDateLong(booking.startsAt, tz))}</p>
              <p className="font-display text-4xl font-extrabold text-ink">{formatTime(booking.startsAt, tz)} h</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-2 font-mono text-xs tracking-widest text-ink-soft">CÓDIGO {booking.code}</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <InfoRow icon={<Car className="size-4" />} title={booking.serviceName}>
            {[VEHICLE_LABEL[booking.vehicleType], booking.vehiclePlate, [booking.vehicleBrand, booking.vehicleModel].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
          </InfoRow>
          <InfoRow icon={<Clock className="size-4" />} title={formatMoney(booking.price)}>
            Duración aprox. {formatDuration(booking.durationMinutes)} · se paga en el lavadero
          </InfoRow>
          <InfoRow icon={<MapPin className="size-4" />} title={business.name}>
            {map ? (
              <a href={map} target="_blank" rel="noopener" className="text-primary hover:underline">
                {[business.address, business.city].filter(Boolean).join(", ") || "Ver en el mapa"}
              </a>
            ) : (
              [business.address, business.city].filter(Boolean).join(", ")
            )}
          </InfoRow>
          {booking.status === "cancelled" && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              Turno cancelado {booking.cancelledBy === "business" ? "por el lavadero" : "por vos"}
              {booking.cancelReason ? `: “${booking.cancelReason}”` : "."}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {active && (
            <a href={gcal.toString()} target="_blank" rel="noopener" className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-primary hover:bg-primary-light">
              <CalendarPlus className="size-4" /> Agendar
            </a>
          )}
          {business.whatsapp && (
            <a
              href={whatsappLink(business.whatsapp, `Hola! Tengo el turno ${booking.code} para el ${formatDateLong(booking.startsAt, tz)} a las ${formatTime(booking.startsAt, tz)}.`)}
              target="_blank"
              rel="noopener"
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-primary hover:bg-primary-light"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
          {business.phone && (
            <a href={`tel:${business.phone}`} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-primary hover:bg-primary-light">
              <Phone className="size-4" /> Llamar
            </a>
          )}
        </div>
      </Card>

      {isCustomer && active && (
        <div className="mt-4">
          <BookingActions
            bookingId={booking.id}
            canModify={customerCanModify(booking, business)}
            windowLabel={windowLabel}
            reschedule={{
              slug: business.slug,
              serviceId: booking.serviceId,
              vehicleType: booking.vehicleType,
              timezone: tz,
              maxDaysAhead: business.maxDaysAhead,
              weekly,
              exceptions,
            }}
          />
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href="/mis-turnos" className="font-semibold text-primary hover:underline">
          Ver mis turnos
        </Link>
        <Link href={`/${business.slug}`} className="font-semibold text-ink-soft hover:underline">
          Sacar otro turno
        </Link>
      </div>
    </main>
  );
}

function InfoRow({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-soft">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-soft">{children}</p>
      </div>
    </div>
  );
}
