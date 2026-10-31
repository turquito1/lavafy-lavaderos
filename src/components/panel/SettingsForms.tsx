"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, ImagePlus, LocateFixed, Minus, Plus, Share2, Trash2 } from "lucide-react";
import type { Business } from "@/db/schema";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Spinner } from "@/components/ui/Spinner";
import {
  removeImageAction,
  setPublishedAction,
  updateLocationAction,
  updateProfileAction,
  updateRulesAction,
  uploadImageAction,
} from "@/server/actions/panel";
import { cn, mapsLink, slugify } from "@/lib/format";
import { SLOT_INTERVAL_OPTIONS } from "@/lib/constants";

type B = Pick<
  Business,
  | "name" | "slug" | "description" | "phone" | "whatsapp" | "instagram" | "email" | "address" | "city" | "province" | "lat" | "lng"
  | "capacity" | "slotIntervalMinutes" | "minLeadMinutes" | "maxDaysAhead" | "cancelWindowMinutes" | "requiresApproval" | "status" | "logoUrl" | "coverUrl"
>;

function useSave() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success = "Cambios guardados") =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(success);
      else toast.error(res.error ?? "No se pudo guardar");
    });
  return { pending, run };
}

function SaveBar({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end border-t border-line px-5 py-3">
      <Button onClick={onClick} loading={pending}>
        Guardar
      </Button>
    </div>
  );
}

// ─── Publicación ──────────────────────────────────────────────────────────────

export function PublishCard({ business, appUrl }: { business: B; appUrl: string }) {
  const { pending, run } = useSave();
  const [copied, setCopied] = useState(false);
  const url = `${appUrl}/${business.slug}`;
  const published = business.status === "active";

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const share = () => navigator.share?.({ title: business.name, text: `Sacá turno en ${business.name}`, url }).catch(() => {});

  return (
    <Card id="publicacion" className="scroll-mt-20">
      <CardHeader title="Tu página de turnos" description="Compartí este link en tu Instagram, WhatsApp y Google Maps." />
      <div className="space-y-4 px-5 py-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-50 p-2 pl-4">
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{url.replace(/^https?:\/\//, "")}</span>
          <Button size="sm" variant="secondary" onClick={copy} icon={copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button size="sm" variant="secondary" onClick={share} className="sm:hidden" icon={<Share2 className="size-4" />} aria-label="Compartir" />
          <a href={`/${business.slug}`} target="_blank" className="hidden rounded-lg p-2 text-muted hover:bg-white hover:text-primary sm:block" aria-label="Abrir">
            <ExternalLink className="size-4" />
          </a>
        </div>
        <div className={cn("flex items-center justify-between gap-4 rounded-xl p-4", published ? "bg-emerald-50" : "bg-amber-50")}>
          <div>
            <p className={cn("font-semibold", published ? "text-emerald-800" : "text-amber-800")}>{published ? "Publicado: estás recibiendo turnos" : "Sin publicar"}</p>
            <p className={cn("text-sm", published ? "text-emerald-700" : "text-amber-700")}>
              {published ? "Aparecés en el buscador de Lavafy y cualquiera puede reservar." : "Solo vos ves la página. Publicala cuando tengas servicios y horarios."}
            </p>
          </div>
          {pending ? (
            <Spinner className="size-5" />
          ) : (
            <Switch
              checked={published}
              disabled={business.status === "suspended"}
              onChange={(v) => run(() => setPublishedAction(v), v ? "¡Listo! Tu lavadero está publicado 🎉" : "Lavadero despublicado")}
              label="Publicado"
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Datos ────────────────────────────────────────────────────────────────────

export function ProfileForm({ business, host }: { business: B; host: string }) {
  const { pending, run } = useSave();
  const [f, setF] = useState({
    name: business.name,
    slug: business.slug,
    description: business.description ?? "",
    phone: business.phone ?? "",
    whatsapp: business.whatsapp ?? "",
    instagram: business.instagram ?? "",
    email: business.email ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <Card>
      <CardHeader title="Datos del lavadero" />
      <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="p-name">
          <Input id="p-name" value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Link" htmlFor="p-slug" hint={f.slug !== business.slug ? "Ojo: el link viejo deja de funcionar." : undefined}>
          <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-line bg-white focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15 md:h-11">
            <span className="shrink-0 border-r border-line bg-slate-50 px-3 text-sm text-muted">{host}/</span>
            <input id="p-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value.replace(/\s/g, "-")) + (e.target.value.endsWith("-") ? "-" : "") })} className="h-full min-w-0 flex-1 px-3 focus:outline-none" />
          </div>
        </Field>
        <Field label="Descripción" htmlFor="p-desc" className="sm:col-span-2" hint="Contá qué te diferencia. Aparece en tu página.">
          <Textarea id="p-desc" rows={3} value={f.description} onChange={set("description")} placeholder="Lavadero con más de 10 años en el barrio. Usamos productos…" />
        </Field>
        <Field label="WhatsApp" htmlFor="p-wa">
          <Input id="p-wa" type="tel" value={f.whatsapp} onChange={set("whatsapp")} placeholder="+54 9 351 123 4567" />
        </Field>
        <Field label="Teléfono" htmlFor="p-phone">
          <Input id="p-phone" type="tel" value={f.phone} onChange={set("phone")} placeholder="351 123 4567" />
        </Field>
        <Field label="Instagram" htmlFor="p-ig">
          <Input id="p-ig" value={f.instagram} onChange={set("instagram")} placeholder="@milavadero" />
        </Field>
        <Field label="Email de avisos" htmlFor="p-email" hint="Te llegan los turnos nuevos a los miembros del panel.">
          <Input id="p-email" type="email" value={f.email} onChange={set("email")} />
        </Field>
      </div>
      <SaveBar pending={pending} onClick={() => run(() => updateProfileAction(f))} />
    </Card>
  );
}

export function ImagesForm({ business, uploadsEnabled }: { business: B; uploadsEnabled: boolean }) {
  return (
    <Card>
      <CardHeader title="Imágenes" description="Logo y foto de portada de tu página." />
      <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-[160px_1fr]">
        <ImageSlot kind="logo" label="Logo" url={business.logoUrl} enabled={uploadsEnabled} className="aspect-square" />
        <ImageSlot kind="cover" label="Portada" url={business.coverUrl} enabled={uploadsEnabled} className="aspect-[3/1] sm:aspect-auto sm:h-40" />
      </div>
      {!uploadsEnabled && <p className="px-5 pb-4 text-xs text-muted">Para subir imágenes, conectá Vercel Blob (variable BLOB_READ_WRITE_TOKEN).</p>}
    </Card>
  );
}

function ImageSlot({ kind, label, url, enabled, className }: { kind: "logo" | "cover"; label: string; url: string | null; enabled: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const upload = (file: File) =>
    start(async () => {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await uploadImageAction(fd);
      if (res.ok) toast.success(`${label} actualizado`);
      else toast.error(res.error);
    });
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-soft">{label}</p>
      <div className={cn("group relative overflow-hidden rounded-xl border-2 border-dashed border-line bg-slate-50", className)}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <button type="button" disabled={!enabled || pending} onClick={() => input.current?.click()} className="flex size-full min-h-24 flex-col items-center justify-center gap-1 text-sm text-muted disabled:cursor-not-allowed">
            <ImagePlus className="size-6" /> Subir
          </button>
        )}
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Spinner />
          </div>
        )}
        {url && enabled && !pending && (
          <div className="absolute right-2 bottom-2 flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
              Cambiar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => start(async () => void (await removeImageAction(kind)))} aria-label="Quitar" icon={<Trash2 className="size-4" />} />
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}

// ─── Ubicación ────────────────────────────────────────────────────────────────

export function LocationForm({ business }: { business: B }) {
  const { pending, run } = useSave();
  const [f, setF] = useState({
    address: business.address ?? "",
    city: business.city ?? "",
    province: business.province ?? "",
    // Se guardan como texto para poder tipear "-", "-31." o pegar "-31.41, -64.19" sin que se rompa el input.
    lat: business.lat != null ? String(business.lat) : "",
    lng: business.lng != null ? String(business.lng) : "",
  });
  const [locating, setLocating] = useState(false);
  const lat = parseCoord(f.lat);
  const lng = parseCoord(f.lng);
  const map = mapsLink({ ...f, lat, lng });

  /** Si pegan "-31.4135, -64.1985" (como lo copia Google Maps) en cualquiera de los dos campos, lo separamos. */
  const setCoord = (key: "lat" | "lng", value: string) => {
    // Solo números con punto decimal, para no confundir "-64,1985" (coma decimal) con un par.
    const pair = /^\s*(-?\d+\.\d+)\s*[,;]?\s*(-?\d+\.\d+)\s*$/.exec(value);
    if (pair) setF({ ...f, lat: pair[1], lng: pair[2] });
    else setF({ ...f, [key]: value.replace(/[^\d.,-]/g, "") });
  };

  const save = () => {
    const latEmpty = f.lat.trim() === "";
    const lngEmpty = f.lng.trim() === "";
    if (latEmpty !== lngEmpty) return toast.error("Completá latitud y longitud, o dejá las dos vacías.");
    if (!latEmpty && (lat === null || lat < -90 || lat > 90)) return toast.error("La latitud tiene que ser un número entre -90 y 90 (ej: -31.4135).");
    if (!lngEmpty && (lng === null || lng < -180 || lng > 180)) return toast.error("La longitud tiene que ser un número entre -180 y 180 (ej: -64.1985).");
    run(() => updateLocationAction({ address: f.address, city: f.city, province: f.province || null, lat, lng }));
  };

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Tu navegador no permite ubicación");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setF((x) => ({ ...x, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        toast.success("Ubicación tomada. Revisala en el mapa y guardá.");
      },
      () => {
        setLocating(false);
        toast.error("No pudimos obtener la ubicación");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <Card>
      <CardHeader title="Ubicación" description="Sirve para que te encuentren en el buscador por cercanía." />
      <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
        <Field label="Dirección" htmlFor="l-address" className="sm:col-span-2">
          <Input id="l-address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="Ciudad" htmlFor="l-city">
          <Input id="l-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
        <Field label="Provincia" htmlFor="l-prov">
          <Input id="l-prov" value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} />
        </Field>
        <div className="rounded-xl border border-line p-4 sm:col-span-2">
          <p className="text-sm font-semibold text-ink">Punto en el mapa</p>
          <p className="mt-0.5 mb-3 text-xs text-muted">
            {lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Todavía no marcaste el punto exacto. Parate en el lavadero y tocá el botón."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" onClick={locate} loading={locating} icon={<LocateFixed className="size-4" />}>
              Usar mi ubicación actual
            </Button>
            {map && (
              <a href={map} target="_blank" rel="noopener" className="flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-ink-soft hover:bg-slate-50">
                <ExternalLink className="size-4" /> Ver en Google Maps
              </a>
            )}
          </div>
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer">Cargar coordenadas a mano</summary>
            <p className="mt-2 mb-2">Tip: en Google Maps tocá el punto del lavadero, copiá las coordenadas (ej. “-31.4135, -64.1985”) y pegalas en cualquiera de los dos campos.</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="text" inputMode="text" placeholder="Latitud (-31.4135)" value={f.lat} onChange={(e) => setCoord("lat", e.target.value)} aria-label="Latitud" aria-invalid={f.lat.trim() !== "" && lat === null} />
              <Input type="text" inputMode="text" placeholder="Longitud (-64.1985)" value={f.lng} onChange={(e) => setCoord("lng", e.target.value)} aria-label="Longitud" aria-invalid={f.lng.trim() !== "" && lng === null} />
            </div>
          </details>
        </div>
      </div>
      <SaveBar pending={pending} onClick={save} />
    </Card>
  );
}

/** "-31.41" o "-31,41" → número; vacío o inválido → null. */
function parseCoord(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (v === "" || !/^-?\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─── Reglas de turnos ─────────────────────────────────────────────────────────

const LEAD_OPTIONS = [
  [0, "Sin anticipación"],
  [30, "30 minutos"],
  [60, "1 hora"],
  [120, "2 horas"],
  [240, "4 horas"],
  [720, "12 horas"],
  [1440, "1 día"],
] as const;
const AHEAD_OPTIONS = [7, 14, 30, 60, 90] as const;
const CANCEL_OPTIONS = [
  [60, "1 hora antes"],
  [120, "2 horas antes"],
  [360, "6 horas antes"],
  [720, "12 horas antes"],
  [1440, "24 horas antes"],
  [2880, "48 horas antes"],
] as const;

export function RulesForm({ business }: { business: B }) {
  const { pending, run } = useSave();
  const [f, setF] = useState({
    capacity: business.capacity,
    slotIntervalMinutes: business.slotIntervalMinutes,
    minLeadMinutes: business.minLeadMinutes,
    maxDaysAhead: business.maxDaysAhead,
    cancelWindowMinutes: business.cancelWindowMinutes,
    requiresApproval: business.requiresApproval,
  });

  return (
    <Card>
      <CardHeader title="Reglas de los turnos" description="Cómo se arma tu agenda online." />
      <div className="divide-y divide-line">
        <Row title="Autos en simultáneo" description="Cuántos vehículos podés atender a la vez. Nunca se dan más turnos superpuestos que esto.">
          <div className="flex h-12 w-full items-center justify-between rounded-[10px] border border-line bg-white px-1.5 md:h-11">
            <button type="button" onClick={() => setF({ ...f, capacity: Math.max(1, f.capacity - 1) })} disabled={f.capacity <= 1} className="flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-slate-100 disabled:opacity-30 md:size-8" aria-label="Menos">
              <Minus className="size-4" />
            </button>
            <span className="font-display text-base font-bold text-ink">
              {f.capacity} {f.capacity === 1 ? "auto" : "autos"}
            </span>
            <button type="button" onClick={() => setF({ ...f, capacity: Math.min(50, f.capacity + 1) })} disabled={f.capacity >= 50} className="flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-slate-100 disabled:opacity-30 md:size-8" aria-label="Más">
              <Plus className="size-4" />
            </button>
          </div>
        </Row>
        <Row title="Turnos cada" description="Cada cuántos minutos arranca un horario (09:00, 09:30…).">
          <Select value={f.slotIntervalMinutes} onChange={(e) => setF({ ...f, slotIntervalMinutes: Number(e.target.value) })} className="w-full">
            {SLOT_INTERVAL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutos
              </option>
            ))}
          </Select>
        </Row>
        <Row title="Anticipación mínima" description="Con cuánto tiempo antes se puede sacar un turno online.">
          <Select value={f.minLeadMinutes} onChange={(e) => setF({ ...f, minLeadMinutes: Number(e.target.value) })} className="w-full">
            {LEAD_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Row>
        <Row title="Reservas hasta" description="Cuántos días para adelante se ve tu agenda.">
          <Select value={f.maxDaysAhead} onChange={(e) => setF({ ...f, maxDaysAhead: Number(e.target.value) })} className="w-full">
            {AHEAD_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </Select>
        </Row>
        <Row title="Cancelar / reprogramar" description="Hasta cuándo el cliente puede cambiar su turno solo. Después tiene que hablar con vos.">
          <Select value={f.cancelWindowMinutes} onChange={(e) => setF({ ...f, cancelWindowMinutes: Number(e.target.value) })} className="w-full">
            {CANCEL_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Row>
        <Row title="Aprobar cada turno" description="Si está activo, los turnos online quedan “por aprobar” hasta que los confirmes.">
          <div className="flex h-12 w-full items-center justify-between rounded-[10px] border border-line bg-white pr-2 pl-4 md:h-11">
            <span className="text-sm font-medium text-ink">{f.requiresApproval ? "Activado" : "Desactivado"}</span>
            <Switch checked={f.requiresApproval} onChange={(v) => setF({ ...f, requiresApproval: v })} label="Aprobar turnos" />
          </div>
        </Row>
      </div>
      <SaveBar pending={pending} onClick={() => run(() => updateRulesAction(f))} />
    </Card>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:max-w-md">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {/* Mismo ancho para todos los controles, así quedan alineados en columna. */}
      <div className="w-full shrink-0 sm:w-56">{children}</div>
    </div>
  );
}
