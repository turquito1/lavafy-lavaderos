"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { playChime, unlockAudio } from "@/lib/chime";
import { formatDateShort, formatTime, utcToZoned } from "@/lib/time";

type Pulse = {
  businessId: string;
  timezone: string;
  version: string | null;
  pending: number;
  latest: { id: string; customerName: string; serviceName: string; startsAt: string; status: string } | null;
};

const VISIBLE_MS = 15_000;
const HIDDEN_MS = 30_000;
const TITLE_PREFIX = /^\(\d+\)\s/;

/**
 * Mantiene el panel "en vivo": consulta /api/panel/pulse cada 15 s y, si cambió algo,
 * refresca la pantalla. Si entró un turno online nuevo, suena, muestra un aviso y
 * (si el dueño lo permitió) manda una notificación del navegador.
 */
export function LivePanel() {
  const router = useRouter();
  const last = useRef<Pick<Pulse, "businessId" | "version"> & { latestId: string | null } | null>(null);
  const unread = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const setTitleCount = (n: number) => {
      const base = document.title.replace(TITLE_PREFIX, "");
      document.title = n > 0 ? `(${n}) ${base}` : base;
    };

    const announce = (latest: NonNullable<Pulse["latest"]>, timezone: string) => {
      const startsAt = new Date(latest.startsAt);
      const when = `${formatDateShort(startsAt, timezone)} · ${formatTime(startsAt, timezone)} h`;
      const href = `/panel/agenda?fecha=${utcToZoned(startsAt, timezone).dateStr}`;
      const title = latest.status === "pending" ? `Turno para aprobar: ${latest.customerName}` : `Nuevo turno: ${latest.customerName}`;
      playChime();
      toast.success(title, {
        description: `${latest.serviceName} · ${when}`,
        duration: 12_000,
        action: { label: "Ver", onClick: () => router.push(href) },
      });
      if (document.visibilityState === "hidden") {
        unread.current += 1;
        setTitleCount(unread.current);
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const n = new Notification(title, { body: `${latest.serviceName} · ${when}`, icon: "/icon-192.png", tag: latest.id });
            n.onclick = () => {
              window.focus();
              router.push(href);
              n.close();
            };
          } catch {
            /* algunos navegadores móviles solo permiten notificaciones desde un service worker */
          }
        }
      }
    };

    const tick = async () => {
      try {
        const res = await fetch("/api/panel/pulse", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Pulse;
          const prev = last.current;
          if (prev && prev.businessId === data.businessId) {
            if (data.latest && data.latest.id !== prev.latestId) announce(data.latest, data.timezone);
            if (data.version !== prev.version) router.refresh();
          }
          last.current = { businessId: data.businessId, version: data.version, latestId: data.latest?.id ?? null };
        }
      } catch {
        /* sin conexión: reintenta en el próximo ciclo */
      }
      if (!stopped) timer = setTimeout(tick, document.visibilityState === "visible" ? VISIBLE_MS : HIDDEN_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      unread.current = 0;
      setTitleCount(0);
      clearTimeout(timer);
      void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", unlockAudio);
    };
  }, [router]);

  return null;
}
