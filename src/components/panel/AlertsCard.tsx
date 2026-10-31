"use client";

import { useSyncExternalStore, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { playChime, unlockAudio } from "@/lib/chime";

const DISMISS_KEY = "lavafy:avisos-descartado";

type State = "unsupported" | "default" | "granted" | "denied" | "dismissed";

function readState(): State {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    if (localStorage.getItem(DISMISS_KEY) === "1" && Notification.permission === "default") return "dismissed";
  } catch {
    /* localStorage bloqueado */
  }
  return Notification.permission as State;
}

const noop = () => () => {};

/** Invita a activar las notificaciones del navegador para enterarse de turnos nuevos. */
export function AlertsCard() {
  const initial = useSyncExternalStore(noop, readState, () => "unsupported" as State);
  const [state, setState] = useState<State | null>(null);
  const current = state ?? initial;
  if (current !== "default") return null;

  const enable = async () => {
    unlockAudio();
    const result = await Notification.requestPermission();
    setState(result as State);
    if (result === "granted") {
      playChime();
      toast.success("¡Listo! Te vamos a avisar cuando entre un turno.", { description: "Dejá esta pestaña abierta (o la app instalada) para recibir los avisos." });
    } else {
      toast.info("Sin notificaciones igual vas a ver y escuchar los turnos nuevos mientras tengas el panel abierto.");
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setState("dismissed");
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary-border bg-primary-light p-4">
      <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Enterate al instante de cada turno nuevo</p>
        <p className="mt-0.5 text-sm text-ink-soft">Activá los avisos y te llega una notificación con sonido aunque estés en otra pestaña.</p>
        <Button size="sm" className="mt-3" onClick={enable}>
          Activar avisos
        </Button>
      </div>
      <button onClick={dismiss} className="rounded-lg p-1.5 text-muted hover:bg-white/70 hover:text-ink" aria-label="Ahora no">
        <X className="size-4" />
      </button>
    </div>
  );
}
