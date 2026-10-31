import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Clock, AtSign, MapPin, MessageCircle, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { OpenNow } from "@/components/booking/OpenNow";
import { HoursTable } from "@/components/booking/HoursTable";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Spinner";
import { getBusinessBySlug, getCatalog, getUpcomingExceptions, getUserVehicles, getWeeklyHours } from "@/server/queries";
import { getMyBusinesses, getSessionUser } from "@/server/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { mapsLink, whatsappLink } from "@/lib/format";
import { RESERVED_SLUGS } from "@/lib/constants";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: "Lavadero no encontrado" };
  return {
    title: `${business.name} · Sacá turno`,
    description: business.description ?? `Reservá tu turno online en ${business.name}${business.city ? `, ${business.city}` : ""}.`,
    openGraph: { title: `${business.name} · Sacá turno online`, images: business.coverUrl ? [business.coverUrl] : undefined },
  };
}

export default function BusinessPage({ params }: PageProps<"/[slug]">) {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <Suspense fallback={<BusinessSkeleton />}>
        <BusinessContent params={params} />
      </Suspense>
    </div>
  );
}

async function BusinessContent({ params }: { params: PageProps<"/[slug]">["params"] }) {
  const { slug } = await params;
  if (RESERVED_SLUGS.has(slug)) notFound();
  const business = await getBusinessBySlug(slug);
  if (!business || business.status === "suspended") notFound();

  const user = await getSessionUser();
  const isMember = user ? (await getMyBusinesses(user.id)).some((m) => m.business.id === business.id) : false;
  if (business.status !== "active" && !isMember) notFound();

  const [catalog, weekly, exceptions, profile, savedVehicles] = await Promise.all([
    getCatalog(business.id, { onlyActive: true }),
    getWeeklyHours(business.id),
    getUpcomingExceptions(business),
    user ? db.select({ phone: users.phone, name: users.name }).from(users).where(eq(users.id, user.id)).then((r) => r[0]) : null,
    user ? getUserVehicles(user.id) : [],
  ]);
  const services = catalog.filter((s) => s.prices.length > 0);
  const map = mapsLink(business);
  const location = [business.address, business.city].filter(Boolean).join(", ");

  return (
    <main className="pb-10">
      {business.status !== "active" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
          Vista previa: tu lavadero todavía no está publicado. Publicalo desde <Link href="/panel/configuracion" className="font-semibold underline">Configuración</Link>.
        </div>
      )}

      {/* Portada */}
      <section className="relative">
        <div className="h-36 overflow-hidden bg-gradient-to-br from-primary via-blue-500 to-accent sm:h-48">
          {business.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.coverUrl} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="-mt-10 flex items-end gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-primary-light font-display text-3xl font-extrabold text-primary shadow-card">
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logoUrl} alt={business.name} className="size-full object-cover" />
              ) : (
                business.name[0]?.toUpperCase()
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{business.name}</h1>
              {location && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                  <MapPin className="size-4 shrink-0 text-primary" />
                  {map ? (
                    <a href={map} target="_blank" rel="noopener" className="hover:underline">
                      {location}
                    </a>
                  ) : (
                    location
                  )}
                </p>
              )}
              <OpenNow timezone={business.timezone} weekly={weekly} exceptions={exceptions} className="mt-2" />
            </div>
            <div className="flex gap-2">
              {business.whatsapp && <ContactButton href={whatsappLink(business.whatsapp, `Hola ${business.name}! `)} icon={<MessageCircle className="size-4" />} label="WhatsApp" />}
              {business.phone && <ContactButton href={`tel:${business.phone}`} icon={<Phone className="size-4" />} label="Llamar" />}
              {business.instagram && <ContactButton href={`https://instagram.com/${business.instagram.replace(/^@/, "")}`} icon={<AtSign className="size-4" />} label="Instagram" />}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-0 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
        {/* Reserva: primero en celular */}
        <div id="reservar" className="min-w-0 scroll-mt-20 lg:order-2">
          <div className="lg:sticky lg:top-20">
            <Card className="overflow-visible rounded-none border-x-0 sm:rounded-2xl sm:border-x">
              <div className="flex items-center justify-between px-5 pt-4">
                <h2 className="text-lg font-bold">Sacá tu turno</h2>
              </div>
              {services.length > 0 ? (
                <Suspense>
                  <BookingFlow
                    business={{
                      slug: business.slug,
                      name: business.name,
                      timezone: business.timezone,
                      maxDaysAhead: business.maxDaysAhead,
                      cancelWindowMinutes: business.cancelWindowMinutes,
                      requiresApproval: business.requiresApproval,
                    }}
                    services={services}
                    weekly={weekly}
                    exceptions={exceptions}
                    user={user ? { name: profile?.name ?? user.name, email: user.email, phone: profile?.phone ?? null } : null}
                    savedVehicles={savedVehicles.map((v) => ({ id: v.id, plate: v.plate, brand: v.brand, model: v.model, type: v.type }))}
                  />
                </Suspense>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-muted">Este lavadero todavía no tiene servicios disponibles para reservar online.</p>
              )}
            </Card>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-4 px-4 sm:px-0 lg:order-1">
          {business.description && (
            <Card className="p-5">
              <h2 className="mb-2 text-base font-bold">Sobre el lavadero</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">{business.description}</p>
            </Card>
          )}
          {services.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-base font-bold">Servicios</h2>
              <ul className="divide-y divide-line">
                {services.map((s) => (
                  <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="font-semibold text-ink">{s.name}</p>
                    {s.description && <p className="mt-0.5 text-sm text-ink-soft">{s.description}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Clock className="size-4 text-primary" /> Horarios
            </h2>
            <HoursTable weekly={weekly} />
          </Card>
        </div>
      </div>
    </main>
  );
}

function ContactButton({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink-soft shadow-soft transition-colors hover:border-primary-border hover:text-primary"
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}

function BusinessSkeleton() {
  return (
    <div>
      <Skeleton className="h-36 rounded-none sm:h-48" />
      <div className="mx-auto max-w-6xl space-y-3 px-4 pt-14 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    </div>
  );
}
