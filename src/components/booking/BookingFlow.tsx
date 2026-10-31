"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bike, Car, CarFront, Check, Clock, ShieldCheck, Truck } from "lucide-react";
import type { VehicleType } from "@/db/schema";
import type { DateException, WeeklyHour } from "@/lib/availability";
import { VEHICLE_TYPES } from "@/lib/constants";
import { cn, formatDuration, formatMoney, normalizePlate, PLATE_RE } from "@/lib/format";
import { dateStrParts, ucfirst } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { GoogleIcon } from "@/components/site/GoogleButton";
import { createBookingAction } from "@/server/actions/bookings";
import { signInWithGoogle } from "@/server/actions/auth";
import type { CatalogService } from "@/server/queries";
import { SlotPicker, type SlotValue } from "./SlotPicker";

export type BookingFlowProps = {
  business: { slug: string; name: string; timezone: string; maxDaysAhead: number; cancelWindowMinutes: number; requiresApproval: boolean };
  services: CatalogService[];
  weekly: WeeklyHour[];
  exceptions: DateException[];
  user: { name: string | null; email: string | null; phone: string | null } | null;
  savedVehicles: { id: string; plate: string; brand: string | null; model: string | null; type: VehicleType }[];
};

type Step = 1 | 2 | 3 | 4;
type Draft = {
  step: Step;
  vehicleType: VehicleType | null;
  serviceId: string | null;
  date: string | null;
  slot: SlotValue;
  name: string;
  phone: string;
  plate: string;
  brand: string;
  model: string;
  notes: string;
};

const STEPS = ["Servicio", "Día y hora", "Tus datos", "Confirmar"] as const;
const DRAFT_TTL_MS = 30 * 60_000;
const VEHICLE_ICONS: Record<VehicleType, typeof Car> = { auto: Car, suv: CarFront, pickup: Truck, moto: Bike };

export function BookingFlow({ business, services, weekly, exceptions, user, savedVehicles }: BookingFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = `lavafy:reserva:${business.slug}`;

  const vehicleTypes = useMemo(
    () => VEHICLE_TYPES.filter((v) => services.some((s) => s.prices.some((p) => p.vehicleType === v.value))),
    [services],
  );

  const initialDraft = (): Draft => ({
    step: 1,
    vehicleType: savedVehicles.find((v) => vehicleTypes.some((t) => t.value === v.type))?.type ?? vehicleTypes[0]?.value ?? null,
    serviceId: null,
    date: null,
    slot: null,
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    plate: savedVehicles[0]?.plate ?? "",
    brand: savedVehicles[0]?.brand ?? "",
    model: savedVehicles[0]?.model ?? "",
    notes: "",
  });

  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [restored, setRestored] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "plate", string>>>({});
  const [submitting, startSubmit] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), []);

  // Recuperar el borrador (ej. al volver del login con Google).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Draft & { savedAt: number };
        if (Date.now() - saved.savedAt < DRAFT_TTL_MS && services.some((s) => s.id === saved.serviceId)) {
          const wantsConfirm = searchParams.get("confirmar") === "1" && user;
          // sessionStorage solo existe en el navegador: hay que leerlo después del montaje.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setDraft((d) => ({
            ...saved,
            name: saved.name || d.name,
            phone: saved.phone || d.phone,
            step: wantsConfirm && saved.slot ? 4 : saved.step,
          }));
        }
      }
    } catch {
      /* sessionStorage no disponible */
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
    } catch {
      /* ignorar */
    }
  }, [draft, restored, storageKey]);

  const service = services.find((s) => s.id === draft.serviceId) ?? null;
  const option = service?.prices.find((p) => p.vehicleType === draft.vehicleType) ?? null;
  const servicesForType = services.filter((s) => s.prices.some((p) => p.vehicleType === draft.vehicleType));

  const goTo = (step: Step) => {
    update({ step });
    requestAnimationFrame(() => document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const validateDetails = () => {
    const next: typeof errors = {};
    if (draft.name.trim().length < 2) next.name = "Ingresá tu nombre";
    const digits = draft.phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) next.phone = "Ingresá un teléfono válido";
    if (!PLATE_RE.test(normalizePlate(draft.plate))) next.plate = "Patente inválida (ej: AB123CD o ABC123)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const confirm = () => {
    if (!draft.serviceId || !draft.vehicleType || !draft.slot) return;
    startSubmit(async () => {
      const res = await createBookingAction({
        slug: business.slug,
        serviceId: draft.serviceId!,
        vehicleType: draft.vehicleType!,
        startsAt: draft.slot!.startsAt,
        customerName: draft.name,
        customerPhone: draft.phone,
        plate: draft.plate,
        brand: draft.brand,
        model: draft.model,
        notes: draft.notes,
      });
      if (res.ok) {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
        setRedirecting(true);
        router.push(`/turno/${res.data.code}?nuevo=1`);
        return;
      }
      toast.error(res.error);
      if (res.code === "SLOT_TAKEN" || res.code === "OUTSIDE_HOURS" || res.code === "INVALID_DATE") {
        update({ slot: null, step: 2 });
        setReloadKey((k) => k + 1);
      }
    });
  };

  if (vehicleTypes.length === 0) {
    return <p className="p-6 text-center text-sm text-muted">Este lavadero todavía no cargó sus servicios.</p>;
  }

  // ── Barra de acción (abajo, fija en celular) ──
  const action = (() => {
    switch (draft.step) {
      case 1:
        return { label: "Elegir horario", disabled: !option, onClick: () => goTo(2) };
      case 2:
        return { label: "Continuar", disabled: !draft.slot, onClick: () => goTo(3) };
      case 3:
        return { label: "Revisar turno", disabled: false, onClick: () => validateDetails() && goTo(4) };
      case 4:
        return null;
    }
  })();

  return (
    <div className="flex flex-col">
      <Stepper step={draft.step} onStep={(s) => s < draft.step && goTo(s)} />

      <div className="px-5 pt-4 pb-6">
        {draft.step > 1 && (
          <button onClick={() => goTo((draft.step - 1) as Step)} className="mb-3 -ml-1 flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-primary">
            <ArrowLeft className="size-4" /> Volver
          </button>
        )}

        {draft.step === 1 && (
          <div className="animate-fade-in">
            {vehicleTypes.length > 1 && (
              <section className="mb-6">
                <StepTitle>¿Qué vehículo traés?</StepTitle>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {vehicleTypes.map((v) => {
                    const Icon = VEHICLE_ICONS[v.value];
                    const active = draft.vehicleType === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => {
                          const keepService = services.find((s) => s.id === draft.serviceId)?.prices.some((p) => p.vehicleType === v.value);
                          update({ vehicleType: v.value, serviceId: keepService ? draft.serviceId : null, slot: null });
                        }}
                        aria-pressed={active}
                        className={cn(
                          "flex h-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.97]",
                          active ? "border-primary bg-primary-light text-primary" : "border-line bg-white text-ink-soft hover:border-primary-border",
                        )}
                      >
                        <Icon className="size-6" strokeWidth={1.8} />
                        {v.short}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <StepTitle>Elegí el servicio</StepTitle>
              <div className="space-y-2">
                {servicesForType.map((s) => {
                  const p = s.prices.find((x) => x.vehicleType === draft.vehicleType)!;
                  const active = draft.serviceId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        update({ serviceId: s.id, slot: active ? draft.slot : null });
                        if (!active) setTimeout(() => goTo(2), 180);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all active:scale-[0.99]",
                        active ? "border-primary bg-primary-light" : "border-line bg-white hover:border-primary-border",
                      )}
                    >
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all", active ? "border-primary bg-primary" : "border-slate-300")}>
                        {active && <Check className="size-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{s.name}</span>
                        {s.description && <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{s.description}</span>}
                        <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                          <Clock className="size-3" /> {formatDuration(p.durationMinutes)}
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-[15px] font-bold text-primary">{formatMoney(p.price)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {draft.step === 2 && service && option && draft.vehicleType && (
          <div className="animate-fade-in">
            <StepTitle hint={`${service.name} · ${formatDuration(option.durationMinutes)}`}>¿Cuándo querés venir?</StepTitle>
            <SlotPicker
              slug={business.slug}
              serviceId={service.id}
              vehicleType={draft.vehicleType}
              timezone={business.timezone}
              maxDaysAhead={business.maxDaysAhead}
              weekly={weekly}
              exceptions={exceptions}
              date={draft.date}
              onDateChange={(date) => update({ date })}
              value={draft.slot}
              onChange={(slot) => {
                update({ slot });
                if (slot) setTimeout(() => goTo(3), 220);
              }}
              reloadKey={reloadKey}
            />
          </div>
        )}

        {draft.step === 3 && (
          <div className="animate-fade-in space-y-4">
            <StepTitle hint="Los usa el lavadero para identificar tu vehículo y avisarte.">Tus datos</StepTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre y apellido" htmlFor="bf-name" error={errors.name}>
                <Input id="bf-name" autoComplete="name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="Juan Pérez" aria-invalid={!!errors.name} />
              </Field>
              <Field label="Teléfono / WhatsApp" htmlFor="bf-phone" error={errors.phone}>
                <Input id="bf-phone" type="tel" inputMode="tel" autoComplete="tel" value={draft.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="351 123 4567" aria-invalid={!!errors.phone} />
              </Field>
            </div>

            {savedVehicles.filter((v) => v.type === draft.vehicleType).length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-ink-soft">Tus vehículos</p>
                <div className="flex flex-wrap gap-2">
                  {savedVehicles
                    .filter((v) => v.type === draft.vehicleType)
                    .map((v) => {
                      const active = normalizePlate(draft.plate) === v.plate;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => update({ plate: v.plate, brand: v.brand ?? "", model: v.model ?? "" })}
                          className={cn("rounded-xl border-2 px-3 py-2 text-left transition-all", active ? "border-primary bg-primary-light" : "border-line bg-white")}
                        >
                          <span className="block font-mono text-sm font-bold tracking-wider text-ink">{v.plate}</span>
                          <span className="block text-xs text-muted">{[v.brand, v.model].filter(Boolean).join(" ") || "—"}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <Field label="Patente" htmlFor="bf-plate" error={errors.plate} hint="ABC123 (vieja) o AB123CD (nueva)">
              <Input
                id="bf-plate"
                value={draft.plate}
                onChange={(e) => update({ plate: e.target.value.toUpperCase() })}
                placeholder="AB123CD"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono tracking-widest uppercase"
                aria-invalid={!!errors.plate}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca" htmlFor="bf-brand">
                <Input id="bf-brand" value={draft.brand} onChange={(e) => update({ brand: e.target.value })} placeholder="Toyota" />
              </Field>
              <Field label="Modelo" htmlFor="bf-model">
                <Input id="bf-model" value={draft.model} onChange={(e) => update({ model: e.target.value })} placeholder="Corolla" />
              </Field>
            </div>
            <Field label="Comentarios (opcional)" htmlFor="bf-notes">
              <Textarea id="bf-notes" rows={2} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Ej: tiene mucho barro, lo dejo a las 9" />
            </Field>
          </div>
        )}

        {draft.step === 4 && service && option && draft.slot && (
          <div className="animate-fade-in">
            <StepTitle>Revisá y confirmá</StepTitle>
            <div className="rounded-2xl border border-primary-border bg-primary-light p-4">
              <p className="font-display text-lg font-bold text-primary">{ucfirst(dateStrParts(draft.slot.date).long)}</p>
              <p className="font-display text-3xl font-extrabold text-ink">{draft.slot.time} h</p>
              <dl className="mt-3 space-y-1.5 border-t border-primary-border pt-3 text-sm">
                <SummaryRow label="Servicio" value={service.name} />
                <SummaryRow label="Duración" value={formatDuration(option.durationMinutes)} />
                <SummaryRow label="Vehículo" value={[normalizePlate(draft.plate), draft.brand, draft.model].filter(Boolean).join(" · ")} />
                <SummaryRow label="A nombre de" value={draft.name} />
                <SummaryRow label="Precio" value={formatMoney(option.price)} strong />
              </dl>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-ink-soft">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" /> Dejás el auto en {business.name} y te avisamos cuando esté listo.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" /> Podés cancelar o reprogramar hasta{" "}
                {business.cancelWindowMinutes >= 60 ? `${Math.round(business.cancelWindowMinutes / 60)} h` : `${business.cancelWindowMinutes} min`} antes.
              </li>
              {business.requiresApproval && (
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" /> El lavadero confirma el turno y te llega un mail.
                </li>
              )}
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" /> Pagás en el lavadero.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Barra inferior: fija en celular, al pie de la tarjeta en desktop */}
      <div className="pb-safe sticky bottom-0 z-20 mt-auto border-t border-line bg-white/95 px-5 py-3 backdrop-blur md:rounded-b-2xl">
        {draft.step < 4 && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {option && service ? (
                <>
                  <p className="truncate text-sm font-semibold text-ink">{service.name}</p>
                  <p className="truncate text-xs text-muted">
                    {formatMoney(option.price)}
                    {draft.slot && <> · <span className="capitalize">{dateStrParts(draft.slot.date).weekdayShort}</span> {dateStrParts(draft.slot.date).day} · {draft.slot.time} h</>}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">Elegí un servicio para empezar</p>
              )}
            </div>
            {action && (
              <Button size="lg" onClick={action.onClick} disabled={action.disabled} className="shrink-0">
                {action.label}
              </Button>
            )}
          </div>
        )}
        {draft.step === 4 &&
          (user ? (
            <Button size="lg" className="w-full" onClick={confirm} loading={submitting || redirecting}>
              Confirmar turno
            </Button>
          ) : (
            <form
              action={signInWithGoogle}
              onSubmit={() => {
                try {
                  sessionStorage.setItem(storageKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
                } catch {}
              }}
            >
              <input type="hidden" name="callbackUrl" value={`/${business.slug}?confirmar=1`} />
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-primary font-display text-[15px] font-semibold text-white shadow-primary transition-all hover:bg-primary-dark active:scale-[0.98]"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-white">
                  <GoogleIcon className="size-4" />
                </span>
                Confirmar con Google
              </button>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
                <ShieldCheck className="size-3.5" /> Validamos el turno con tu cuenta de Google. No publicamos nada.
              </p>
            </form>
          ))}
      </div>
    </div>
  );
}

function Stepper({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  return (
    <div className="border-b border-line px-5 pt-4 pb-3">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
              <button
                type="button"
                onClick={() => onStep(n)}
                disabled={!done}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  done && "bg-primary text-white",
                  current && "bg-primary text-white ring-4 ring-primary/15",
                  !done && !current && "bg-slate-100 text-muted",
                )}
                aria-label={`Paso ${n}: ${label}`}
                aria-current={current ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </button>
              {i < STEPS.length - 1 && <span className={cn("mx-1.5 h-0.5 flex-1 rounded transition-colors", done ? "bg-primary" : "bg-slate-200")} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-sm font-semibold text-primary">{STEPS[step - 1]}</p>
    </div>
  );
}

function StepTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[17px] font-bold text-ink">{children}</h3>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={cn("text-right font-medium text-ink", strong && "font-display text-base font-bold text-primary")}>{value}</dd>
    </div>
  );
}
