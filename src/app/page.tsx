import { Suspense } from "react";
import { CalendarCheck, Clock, MapPinned, Search, Sparkles, Store } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SearchBar } from "@/components/directory/SearchBar";
import { BusinessCard } from "@/components/directory/BusinessCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Spinner";
import { searchDirectory } from "@/server/queries";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-clip bg-gradient-to-br from-[#F0F7FF] via-white to-bg">
        <div className="pointer-events-none absolute top-0 right-0 size-[500px] translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,#DBEAFE_0%,transparent_70%)] opacity-40" />
        <div className="pointer-events-none absolute bottom-0 left-0 size-[400px] -translate-x-1/3 translate-y-1/3 rounded-full bg-[radial-gradient(circle,#BAE6FD_0%,transparent_70%)] opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 pt-12 pb-12 text-center sm:px-6 sm:pt-20 sm:pb-20 lg:px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink-soft shadow-soft sm:mb-8 sm:text-sm">
            <span className="size-2 animate-pulse rounded-full bg-green-500" />
            Turnos online en lavaderos de tu zona
          </div>
          <h1 className="mb-4 text-[clamp(30px,5vw,58px)] leading-tight font-extrabold sm:mb-6">
            <span className="text-ink">Tu auto limpio,</span>
            <br />
            <span className="text-primary">sin hacer fila.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-[540px] px-2 text-sm text-ink-soft sm:mb-12 sm:text-lg">
            Encontrá un lavadero cerca, elegí el servicio y sacá turno en un minuto. Dejás el auto y te avisamos cuando está listo.
          </p>
          <Suspense fallback={<Skeleton className="mx-auto h-[68px] max-w-2xl" />}>
            <SearchBar />
          </Suspense>
        </div>
      </section>

      {/* Resultados */}
      <section id="lavaderos" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-14 sm:px-6 lg:px-8">
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </section>

      {/* Cómo funciona */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">Así de fácil</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { icon: Search, title: "Buscá tu lavadero", text: "Mirá los lavaderos cerca tuyo, sus servicios y precios." },
              { icon: CalendarCheck, title: "Elegí día y hora", text: "Ves los horarios libres en tiempo real. Sin llamar ni esperar respuesta." },
              { icon: Sparkles, title: "Dejá el auto", text: "Llevalo en el horario elegido y retiralo limpio. Te avisamos por mail." },
            ].map((s, i) => (
              <div key={s.title} className="flex gap-4 sm:flex-col sm:items-center sm:text-center">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <s.icon className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">PASO {i + 1}</p>
                  <h3 className="mt-0.5 font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para lavaderos */}
      <section id="para-lavaderos" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-darker px-6 py-10 text-white shadow-card sm:px-12 sm:py-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <Store className="size-3.5" /> Para dueños de lavaderos
              </p>
              <h2 className="text-3xl font-extrabold sm:text-4xl">Llená tu agenda sin atender el teléfono</h2>
              <p className="mt-4 text-blue-100">Tus clientes sacan turno solos desde tu link. Vos manejás la agenda, la capacidad del lavadero y los autos del día desde el celular.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/panel/nuevo" variant="secondary" size="lg" className="border-0 text-primary">
                  Registrar mi lavadero gratis
                </ButtonLink>
              </div>
              <p className="mt-3 text-xs text-blue-200">30 días de prueba. Sin tarjeta.</p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { icon: CalendarCheck, t: "Turnos online 24/7", d: "Con tu propio link para compartir por WhatsApp e Instagram." },
                { icon: Clock, t: "Capacidad real", d: "Definís cuántos autos atendés a la vez y nunca se superponen." },
                { icon: MapPinned, t: "Aparecés en Lavafy", d: "Clientes nuevos te encuentran buscando por zona." },
                { icon: Sparkles, t: "Avisos automáticos", d: "Confirmaciones, recordatorios y “tu auto está listo” por mail." },
              ].map((f) => (
                <li key={f.t} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <f.icon className="mb-2 size-5 text-blue-100" />
                  <p className="font-semibold">{f.t}</p>
                  <p className="mt-1 text-sm text-blue-100">{f.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const lat = typeof sp.lat === "string" ? Number(sp.lat) : undefined;
  const lng = typeof sp.lng === "string" ? Number(sp.lng) : undefined;
  const results = await searchDirectory({ q, lat, lng });
  const filtered = !!q || lat !== undefined;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{filtered ? "Resultados" : "Lavaderos en Lavafy"}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {results.length} lavadero{results.length !== 1 ? "s" : ""}
          {lat !== undefined ? " · ordenados por cercanía" : ""}
          {q ? ` · “${q}”` : ""}
        </p>
      </div>
      {results.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="size-6" />}
            title={filtered ? "No encontramos lavaderos con esa búsqueda" : "Todavía no hay lavaderos publicados"}
            description={filtered ? "Probá con otra zona o borrá los filtros." : "¿Tenés un lavadero? Sumalo y empezá a recibir turnos."}
            action={!filtered ? <ButtonLink href="/panel/nuevo">Registrar mi lavadero</ButtonLink> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((b) => (
            <BusinessCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-60" />
        ))}
      </div>
    </div>
  );
}
