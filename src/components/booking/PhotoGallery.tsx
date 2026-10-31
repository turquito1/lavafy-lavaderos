"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Photo = { id: string; url: string };

/** Tira de fotos del lavadero + visor a pantalla completa (se desliza con el dedo). */
export function PhotoGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <div className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenAt(i)}
            className="relative h-28 w-40 shrink-0 snap-start overflow-hidden rounded-xl bg-slate-100 shadow-soft transition-transform active:scale-[0.98] sm:h-36 sm:w-52"
            aria-label={`Ver foto ${i + 1} de ${photos.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${name}, foto ${i + 1}`} className="size-full object-cover" loading={i < 3 ? "eager" : "lazy"} />
          </button>
        ))}
      </div>
      {openAt !== null && <Lightbox photos={photos} start={openAt} name={name} onClose={() => setOpenAt(null)} />}
    </>
  );
}

function Lightbox({ photos, start, name, onClose }: { photos: Photo[]; start: number; name: string; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);

  const goTo = useCallback((i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: smooth ? "smooth" : "instant" });
  }, [photos.length]);

  useEffect(() => {
    goTo(start, false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [start, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, goTo, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`Fotos de ${name}`}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium text-white/80">
          {index + 1} / {photos.length}
        </span>
        <button onClick={onClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
          <X className="size-6" />
        </button>
      </div>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="scrollbar-none flex flex-1 snap-x snap-mandatory overflow-x-auto"
      >
        {photos.map((p, i) => (
          <div key={p.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2 pb-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${name}, foto ${i + 1}`} className="max-h-full max-w-full rounded-lg object-contain" loading={Math.abs(i - start) < 2 ? "eager" : "lazy"} />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-0 md:block"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index === photos.length - 1}
            className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-0 md:block"
            aria-label="Foto siguiente"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
