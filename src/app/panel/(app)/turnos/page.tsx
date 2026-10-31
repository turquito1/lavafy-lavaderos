import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { ListChecks, Search } from "lucide-react";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/Spinner";
import { BookingList } from "@/components/panel/BookingUI";
import { requireBusiness } from "@/server/session";
import { toBookingDTO } from "@/lib/booking-dto";
import { cn } from "@/lib/format";

export const metadata: Metadata = { title: "Turnos" };

const TABS = [
  { key: "proximos", label: "Próximos" },
  { key: "pendientes", label: "Por aprobar" },
  { key: "historial", label: "Historial" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function BookingsPage({ searchParams }: PageProps<"/panel/turnos">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/panel/turnos">["searchParams"] }) {
  const { business } = await requireBusiness();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "proximos";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const now = new Date();

  const where: SQL[] = [eq(bookings.businessId, business.id)];
  if (tab === "proximos") where.push(gte(bookings.endsAt, now), inArray(bookings.status, ["pending", "confirmed", "in_progress", "ready"]));
  if (tab === "pendientes") where.push(eq(bookings.status, "pending"), gte(bookings.endsAt, now));
  if (tab === "historial") where.push(or(lt(bookings.endsAt, now), inArray(bookings.status, ["completed", "cancelled", "no_show"]))!);
  if (q) {
    const term = `%${q}%`;
    where.push(or(ilike(bookings.customerName, term), ilike(bookings.vehiclePlate, term), ilike(bookings.code, term), ilike(bookings.customerPhone, term))!);
  }
  const rows = await db
    .select()
    .from(bookings)
    .where(and(...where))
    .orderBy(tab === "historial" ? desc(bookings.startsAt) : asc(bookings.startsAt))
    .limit(200);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <PageHeader title="Turnos" description="Buscá por nombre, patente, teléfono o código." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/panel/turnos?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn("flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold whitespace-nowrap transition-all sm:flex-none", tab === t.key ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="relative sm:w-72">
          <input type="hidden" name="tab" value={tab} />
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar…"
            className="h-11 w-full rounded-[10px] border border-line bg-white pr-3 pl-10 focus:border-primary focus:ring-[3px] focus:ring-primary/15 focus:outline-none"
            enterKeyHint="search"
          />
        </form>
      </div>
      <BookingList
        bookings={rows.map(toBookingDTO)}
        business={{ timezone: business.timezone, slotIntervalMinutes: business.slotIntervalMinutes, capacity: business.capacity, name: business.name }}
        showDate
        empty={
          <Card>
            <EmptyState
              icon={<ListChecks className="size-6" />}
              title={q ? "No encontramos turnos" : tab === "pendientes" ? "No hay turnos por aprobar" : tab === "proximos" ? "No hay turnos próximos" : "Todavía no hay historial"}
              description={q ? "Probá con otra búsqueda." : undefined}
            />
          </Card>
        }
      />
    </div>
  );
}
