"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LocateFixed, Search, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/format";

export function SearchBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();
  const geoActive = sp.has("lat") && sp.has("lng");

  const go = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.push(`/?${next.toString()}#lavaderos`, { scroll: false }));
    requestAnimationFrame(() => document.getElementById("lavaderos")?.scrollIntoView({ behavior: "smooth" }));
  };

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Tu navegador no permite ubicación");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        go({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) });
      },
      () => {
        setLocating(false);
        toast.error("No pudimos obtener tu ubicación. Revisá los permisos.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go({ q: q.trim() || null });
      }}
      className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-3 shadow-card sm:p-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex h-12 flex-1 items-center gap-3 rounded-xl border border-line px-4 sm:border-0">
          <Search className="size-4 shrink-0 text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre del lavadero, barrio o ciudad"
            className="h-full w-full bg-transparent text-ink placeholder:text-muted focus:outline-none"
            enterKeyHint="search"
          />
          {q && (
            <button type="button" onClick={() => { setQ(""); go({ q: null }); }} className="text-muted hover:text-ink" aria-label="Borrar búsqueda">
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (geoActive ? go({ lat: null, lng: null }) : locate())}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors sm:flex-none",
              geoActive ? "border-primary-border bg-primary-light text-primary" : "border-line bg-white text-ink-soft hover:bg-slate-50",
            )}
          >
            {locating ? <Spinner className="size-4" /> : geoActive ? <X className="size-4" /> : <LocateFixed className="size-4" />}
            {geoActive ? "Cerca mío" : "Cerca mío"}
          </button>
          <button type="submit" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-display text-[15px] font-semibold text-white shadow-primary transition-all hover:bg-primary-dark active:scale-[0.98] sm:flex-none">
            {pending ? <Spinner className="size-4" /> : <Search className="size-4" />}
            Buscar
          </button>
        </div>
      </div>
    </form>
  );
}
