import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageSkeleton } from "@/components/ui/Spinner";
import { ButtonLink } from "@/components/ui/Button";
import { requireUser } from "@/server/session";
import { getCustomerBookings } from "@/server/queries";
import { formatDateShort, formatTime, nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Mis turnos" };

export default function MyBookingsPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <Suspense fallback={<PageSkeleton />}>
        <MyBookings />
      </Suspense>
    </div>
  );
}

async function MyBookings() {
  const user = await requireUser("/mis-turnos");
  await connection();
  const rows = await getCustomerBookings(user.id);
  const now = nowMs();
  const upcoming = rows.filter((r) => r.booking.endsAt.getTime() >= now && !["cancelled", "completed", "no_show"].includes(r.booking.status)).reverse();
  const past = rows.filter((r) => !upcoming.includes(r));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <PageHeader title="Mis turnos" description={user.email ?? undefined} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title="Todavía no sacaste turnos"
            description="Buscá un lavadero cerca y reservá en un minuto."
            action={<ButtonLink href="/">Buscar lavaderos</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          <Section title="Próximos" rows={upcoming} empty="No tenés turnos próximos." />
          {past.length > 0 && <Section title="Anteriores" rows={past} />}
        </div>
      )}
    </main>
  );
}

function Section({ title, rows, empty }: { title: string; rows: Awaited<ReturnType<typeof getCustomerBookings>>; empty?: string }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <Card className="divide-y divide-line">
          {rows.map(({ booking, business }) => (
            <Link key={booking.id} href={`/turno/${booking.code}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50">
              <div className="w-16 shrink-0 text-center">
                <p className="text-xs font-medium text-muted capitalize">{formatDateShort(booking.startsAt, business.timezone)}</p>
                <p className="font-display text-lg font-bold text-ink">{formatTime(booking.startsAt, business.timezone)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{business.name}</p>
                <p className="truncate text-sm text-ink-soft">
                  {booking.serviceName}
                  {booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ""}
                </p>
              </div>
              <StatusBadge status={booking.status} className="hidden sm:inline-flex" />
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}
