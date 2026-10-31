import Link from "next/link";
import { MapPin, Navigation } from "lucide-react";
import type { DirectoryItem } from "@/server/queries";
import { formatMoney } from "@/lib/format";

export function BusinessCard({ b }: { b: DirectoryItem }) {
  return (
    <Link href={`/${b.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card">
      <div className="relative h-28 bg-gradient-to-br from-primary via-blue-500 to-accent">
        {(b.coverUrl ?? b.photoUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(b.coverUrl ?? b.photoUrl)!} alt="" className="size-full object-cover" loading="lazy" />
        )}
        {b.distanceKm !== null && (
          <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
            <Navigation className="size-3 text-primary" /> {b.distanceKm < 1 ? `${Math.round(b.distanceKm * 1000)} m` : `${b.distanceKm.toFixed(1)} km`}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 pt-0">
        <div className="relative z-10 -mt-7 mb-2 flex size-14 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-primary-light font-display text-xl font-extrabold text-primary shadow-soft">
          {b.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logoUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            b.name[0]?.toUpperCase()
          )}
        </div>
        <h3 className="font-bold text-ink group-hover:text-primary">{b.name}</h3>
        {(b.address || b.city) && (
          <p className="mt-1 flex items-start gap-1 text-sm text-ink-soft">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" />
            <span className="line-clamp-1">{[b.address, b.city].filter(Boolean).join(", ")}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-xs text-muted">{b.minPrice !== null ? <>Desde <strong className="text-sm text-ink">{formatMoney(b.minPrice)}</strong></> : " "}</span>
          <span className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-white">Sacar turno</span>
        </div>
      </div>
    </Link>
  );
}
