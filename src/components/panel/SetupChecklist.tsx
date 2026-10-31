import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { db } from "@/db";
import { openingHours, servicePrices, services } from "@/db/schema";
import { requireBusiness } from "@/server/session";
import { cn } from "@/lib/format";

/** Guía de primeros pasos. Desaparece cuando el lavadero está publicado. */
export async function SetupChecklist() {
  const { business } = await requireBusiness();
  if (business.status !== "draft") return null;
  const [[{ priced }], [{ hours }]] = await Promise.all([
    db
      .select({ priced: sql<number>`count(*)::int` })
      .from(services)
      .innerJoin(servicePrices, eq(servicePrices.serviceId, services.id))
      .where(and(eq(services.businessId, business.id), eq(services.active, true))),
    db.select({ hours: sql<number>`count(*)::int` }).from(openingHours).where(eq(openingHours.businessId, business.id)),
  ]);
  const steps = [
    { done: true, label: "Crear el lavadero", href: "/panel/configuracion" },
    { done: priced > 0, label: "Cargar servicios y precios", href: "/panel/servicios" },
    { done: hours > 0, label: "Revisar horarios", href: "/panel/horarios" },
    { done: false, label: "Publicar y compartir tu link", href: "/panel/configuracion#publicacion" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="mb-6 rounded-2xl border border-primary-border bg-primary-light p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Rocket className="size-5 text-primary" />
        <p className="font-display font-bold text-ink">Primeros pasos</p>
        <span className="ml-auto text-xs font-semibold text-primary">
          {doneCount}/{steps.length}
        </span>
      </div>
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/70", s.done ? "text-ink-soft line-through decoration-slate-300" : "font-medium text-ink")}>
              {s.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-primary" />}
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
