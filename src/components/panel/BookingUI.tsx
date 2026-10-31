"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Car,
  Check,
  CheckCheck,
  ChevronRight,
  Footprints,
  MessageCircle,
  Phone,
  PlayCircle,
  Sparkles,
  StickyNote,
  UserX,
  XCircle,
} from "lucide-react";
import type { BookingStatus, VehicleType } from "@/db/schema";
import type { BookingDTO } from "@/lib/booking-dto";
import type { CatalogService } from "@/server/queries";
import { SOURCE_LABEL, STATUS_CONFIG, STATUS_TRANSITIONS, VEHICLE_LABEL, VEHICLE_TYPES } from "@/lib/constants";
import { cn, formatDuration, formatMoney, whatsappLink } from "@/lib/format";
import { formatDateLong, formatTime, hhmmToMinute, minuteToHHMM, todayStr, utcToZoned, zonedToUtc } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  cancelBookingByBusinessAction,
  createManualBookingAction,
  rescheduleByBusinessAction,
  setBookingStatusAction,
  updateInternalNotesAction,
} from "@/server/actions/panel";

export type PanelBusiness = { timezone: string; slotIntervalMinutes: number; capacity: number; name: string };

/** Siguiente paso natural de un turno, para el botón rápido. */
const NEXT_ACTION: Partial<Record<BookingStatus, { to: BookingStatus; label: string; icon: typeof Check }>> = {
  pending: { to: "confirmed", label: "Aprobar", icon: Check },
  confirmed: { to: "in_progress", label: "Recibir auto", icon: PlayCircle },
  in_progress: { to: "ready", label: "Está listo", icon: Sparkles },
  ready: { to: "completed", label: "Entregado", icon: CheckCheck },
};

const ACTION_LABEL: Record<BookingStatus, string> = {
  pending: "Volver a pendiente",
  confirmed: "Confirmar",
  in_progress: "Marcar en lavado",
  ready: "Marcar listo",
  completed: "Marcar entregado",
  cancelled: "Cancelar",
  no_show: "No vino",
};

const STATUS_ORDER: BookingStatus[] = ["pending", "confirmed", "in_progress", "ready", "completed"];

/** Etiqueta del botón: si vuelve a un estado anterior, se aclara que es para deshacer. */
function transitionLabel(from: BookingStatus, to: BookingStatus) {
  const next = NEXT_ACTION[from];
  if (next?.to === to) return next.label;
  const back = STATUS_ORDER.indexOf(to) >= 0 && STATUS_ORDER.indexOf(to) < STATUS_ORDER.indexOf(from);
  return back ? `Volver a “${STATUS_CONFIG[to].label}”` : ACTION_LABEL[to];
}

function useStatusChange() {
  const [pending, start] = useTransition();
  const change = (booking: BookingDTO, status: BookingStatus, onDone?: () => void) =>
    start(async () => {
      const res = await setBookingStatusAction(booking.id, status);
      if (res.ok) {
        if (status === "ready") toast.success(booking.customerEmail ? "Listo. Le avisamos al cliente por mail ✨" : "Marcado como listo");
        else if (status === "confirmed" && booking.status === "pending") toast.success(booking.customerEmail ? "Turno aprobado. Le avisamos al cliente." : "Turno aprobado");
        onDone?.();
      } else toast.error(res.error);
    });
  return { pending, change };
}

// ─── Fila de turno ────────────────────────────────────────────────────────────

export function BookingRow({ booking, business, onOpen, showDate }: { booking: BookingDTO; business: PanelBusiness; onOpen: () => void; showDate?: boolean }) {
  const { pending, change } = useStatusChange();
  const next = NEXT_ACTION[booking.status];
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const inactive = booking.status === "cancelled" || booking.status === "no_show";

  return (
    <div className={cn("flex items-stretch gap-3 bg-white px-4 py-3 transition-colors hover:bg-slate-50/70 sm:px-5", inactive && "opacity-60")}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4">
        <div className="w-14 shrink-0 text-center">
          {showDate && <p className="text-[11px] font-medium text-muted capitalize">{formatDateLong(start, business.timezone).split(" ").slice(0, 2).join(" ")}</p>}
          <p className="font-display text-lg leading-tight font-bold text-ink">{formatTime(start, business.timezone)}</p>
          <p className="text-[11px] text-muted">a {formatTime(end, business.timezone)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate font-semibold text-ink", inactive && "line-through")}>{booking.customerName}</p>
            {booking.source !== "online" && (
              <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-muted uppercase sm:inline">{SOURCE_LABEL[booking.source]}</span>
            )}
          </div>
          <p className="truncate text-sm text-ink-soft">
            {booking.vehiclePlate && <span className="mr-1.5 font-mono text-xs font-bold tracking-wider text-ink">{booking.vehiclePlate}</span>}
            {booking.serviceName}
          </p>
          <div className="mt-1 sm:hidden">
            <StatusBadge status={booking.status} />
          </div>
        </div>
        <div className="hidden shrink-0 sm:block">
          <StatusBadge status={booking.status} />
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {next && (
          <Button size="sm" variant={booking.status === "pending" ? "primary" : "soft"} loading={pending} icon={<next.icon className="size-4" />} onClick={() => change(booking, next.to)} className="px-2.5 sm:px-3.5">
            <span className="hidden sm:inline">{next.label}</span>
          </Button>
        )}
        <button onClick={onOpen} className="rounded-lg p-2 text-muted hover:bg-slate-100" aria-label="Ver detalle">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Detalle de turno ─────────────────────────────────────────────────────────

export function BookingSheet({ booking, business, onClose }: { booking: BookingDTO | null; business: PanelBusiness; onClose: () => void }) {
  if (!booking) return null;
  // La key reinicia el estado interno (modo, notas) al abrir otro turno.
  return <BookingSheetBody key={`${booking.id}:${booking.internalNotes ?? ""}`} booking={booking} business={business} onClose={onClose} />;
}

function BookingSheetBody({ booking, business, onClose }: { booking: BookingDTO; business: PanelBusiness; onClose: () => void }) {
  const { pending, change } = useStatusChange();
  const [mode, setMode] = useState<"view" | "cancel" | "move">("view");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState(booking.internalNotes ?? "");
  const [savingNotes, startNotes] = useTransition();
  const [cancelling, startCancel] = useTransition();
  const tz = business.timezone;
  const start = new Date(booking.startsAt);
  const transitions = STATUS_TRANSITIONS[booking.status].filter((s) => s !== "cancelled");
  const canCancel = ["pending", "confirmed", "in_progress", "ready"].includes(booking.status);
  const canMove = ["pending", "confirmed"].includes(booking.status);

  const doCancel = () =>
    startCancel(async () => {
      const res = await cancelBookingByBusinessAction(booking.id, reason);
      if (res.ok) {
        toast.success("Turno cancelado. Le avisamos al cliente.");
        onClose();
      } else toast.error(res.error);
    });

  return (
    <Sheet
      open={!!booking}
      onClose={onClose}
      title={booking.customerName}
      description={`${formatDateLong(start, tz)} · ${formatTime(start, tz)} h · #${booking.code}`}
      size="md"
    >
      {mode === "move" ? (
        <RescheduleForm booking={booking} business={business} onDone={onClose} onBack={() => setMode("view")} />
      ) : mode === "cancel" ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            {booking.customerEmail ? "Le mandamos un mail al cliente avisando la cancelación." : "Este cliente no tiene mail: avisale por teléfono o WhatsApp."}
          </p>
          <Field label="Motivo (opcional, lo ve el cliente)" htmlFor="c-reason">
            <Textarea id="c-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: se cortó el agua, te reprogramamos" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setMode("view")}>
              Volver
            </Button>
            <Button variant="danger" onClick={doCancel} loading={cancelling}>
              Cancelar turno
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-soft">{SOURCE_LABEL[booking.source]}</span>
            {!booking.hasAccount && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-soft">Sin cuenta</span>}
          </div>

          <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
            <Info icon={<Car className="size-4" />} title={booking.serviceName}>
              {[VEHICLE_LABEL[booking.vehicleType], booking.vehiclePlate, [booking.vehicleBrand, booking.vehicleModel].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </Info>
            <Info icon={<CalendarClock className="size-4" />} title={`${formatTime(start, tz)} a ${formatTime(new Date(booking.endsAt), tz)} h`}>
              {formatDuration(booking.durationMinutes)} · {formatMoney(booking.price)}
            </Info>
            {booking.notes && (
              <Info icon={<StickyNote className="size-4" />} title="Comentario del cliente">
                {booking.notes}
              </Info>
            )}
            {booking.status === "cancelled" && booking.cancelReason && (
              <Info icon={<XCircle className="size-4" />} title={`Cancelado por ${booking.cancelledBy === "business" ? "el lavadero" : "el cliente"}`}>
                {booking.cancelReason}
              </Info>
            )}
          </div>

          {(booking.customerPhone || booking.customerEmail) && (
            <div className="flex flex-wrap gap-2">
              {booking.customerPhone && (
                <>
                  <a
                    href={whatsappLink(booking.customerPhone, `Hola ${booking.customerName.split(" ")[0]}! Te escribimos de ${business.name} por tu turno del ${formatDateLong(start, tz)} a las ${formatTime(start, tz)}.`)}
                    target="_blank"
                    rel="noopener"
                    className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                  <a href={`tel:${booking.customerPhone}`} className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-ink-soft hover:bg-slate-200">
                    <Phone className="size-4" /> {booking.customerPhone}
                  </a>
                </>
              )}
              {booking.customerEmail && <span className="flex h-10 items-center px-1 text-sm text-muted">{booking.customerEmail}</span>}
            </div>
          )}

          {transitions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Cambiar estado</p>
              <div className="grid grid-cols-2 gap-2">
                {transitions.map((s) => (
                  <Button
                    key={s}
                    variant={s === NEXT_ACTION[booking.status]?.to ? "primary" : "secondary"}
                    loading={pending}
                    onClick={() => change(booking, s, onClose)}
                    icon={s === "no_show" ? <UserX className="size-4" /> : undefined}
                  >
                    {transitionLabel(booking.status, s)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Field label="Notas internas (solo las ve el lavadero)" htmlFor="b-notes">
            <Textarea id="b-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: tiene rayón en la puerta trasera" />
          </Field>
          {notes !== (booking.internalNotes ?? "") && (
            <Button
              size="sm"
              variant="soft"
              loading={savingNotes}
              onClick={() =>
                startNotes(async () => {
                  const res = await updateInternalNotesAction(booking.id, notes);
                  if (res.ok) toast.success("Nota guardada");
                  else toast.error(res.error);
                })
              }
            >
              Guardar nota
            </Button>
          )}

          {(canMove || canCancel) && (
            <div className="flex gap-2 border-t border-line pt-4">
              {canMove && (
                <Button variant="secondary" className="flex-1" icon={<CalendarClock className="size-4" />} onClick={() => setMode("move")}>
                  Reprogramar
                </Button>
              )}
              {canCancel && (
                <Button variant="secondary" className="flex-1 text-red-600 hover:bg-red-50" icon={<XCircle className="size-4" />} onClick={() => setMode("cancel")}>
                  Cancelar
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Info({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm break-words text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

// ─── Fecha + hora (panel) ─────────────────────────────────────────────────────

function timeOptions(step: number) {
  const out: string[] = [];
  for (let m = 0; m < 1440; m += step) out.push(minuteToHHMM(m));
  return out;
}

function roundUp(minute: number, step: number) {
  return Math.min(1440 - step, Math.ceil(minute / step) * step);
}

function RescheduleForm({ booking, business, onDone, onBack }: { booking: BookingDTO; business: PanelBusiness; onDone: () => void; onBack: () => void }) {
  const current = utcToZoned(new Date(booking.startsAt), business.timezone);
  const [date, setDate] = useState(current.dateStr);
  const [time, setTime] = useState(minuteToHHMM(roundUp(current.minute, business.slotIntervalMinutes)));
  const [overCapacity, setOverCapacity] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (force = false) =>
    start(async () => {
      const startsAt = zonedToUtc(date, hhmmToMinute(time)!, business.timezone).toISOString();
      const res = await rescheduleByBusinessAction(booking.id, startsAt, force);
      if (res.ok) {
        toast.success(booking.customerEmail ? "Turno movido. Le avisamos al cliente." : "Turno movido");
        onDone();
      } else if (res.code === "CAPACITY") setOverCapacity(res.error);
      else toast.error(res.error);
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día" htmlFor="r-date">
          <Input id="r-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setOverCapacity(null); }} />
        </Field>
        <Field label="Hora" htmlFor="r-time">
          <Select id="r-time" value={time} onChange={(e) => { setTime(e.target.value); setOverCapacity(null); }}>
            {timeOptions(business.slotIntervalMinutes).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      {overCapacity ? (
        <div className="space-y-3 rounded-xl bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{overCapacity}</p>
          <Button className="w-full" onClick={() => submit(true)} loading={pending}>
            Moverlo igual
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onBack}>
            Volver
          </Button>
          <Button onClick={() => submit()} loading={pending}>
            Mover turno
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Nuevo turno manual / walk-in ─────────────────────────────────────────────

type NewBookingProps = {
  open: boolean;
  onClose: () => void;
  business: PanelBusiness;
  services: CatalogService[];
  defaultDate: string;
  walkIn: boolean;
};

export function NewBookingSheet(props: NewBookingProps) {
  if (!props.open) return null;
  // Se monta de cero cada vez que se abre: arranca con los valores por defecto.
  return <NewBookingForm key={`${props.walkIn}:${props.defaultDate}`} {...props} />;
}

function NewBookingForm({ open, onClose, business, services, defaultDate, walkIn }: NewBookingProps) {
  const available = useMemo(() => services.filter((s) => s.active && s.prices.length > 0), [services]);
  const init = () => {
    const now = utcToZoned(new Date(), business.timezone);
    const isToday = defaultDate === now.dateStr;
    return {
      kind: walkIn ? ("walk_in" as const) : ("manual" as const),
      serviceId: available[0]?.id ?? "",
      vehicleType: (available[0]?.prices[0]?.vehicleType ?? "auto") as VehicleType,
      date: walkIn ? now.dateStr : defaultDate,
      time: minuteToHHMM(walkIn ? now.minute - (now.minute % 5) : isToday ? roundUp(now.minute, business.slotIntervalMinutes) : 9 * 60),
      name: "",
      phone: "",
      email: "",
      plate: "",
      brand: "",
      model: "",
      notes: "",
    };
  };
  const [f, setF] = useState(init);
  const [overCapacity, setOverCapacity] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const service = available.find((s) => s.id === f.serviceId);
  const types = VEHICLE_TYPES.filter((v) => service?.prices.some((p) => p.vehicleType === v.value));
  const option = service?.prices.find((p) => p.vehicleType === f.vehicleType);
  const times = useMemo(() => {
    const step = f.kind === "walk_in" ? 5 : business.slotIntervalMinutes;
    const list = timeOptions(step);
    return list.includes(f.time) ? list : [...list, f.time].sort();
  }, [f.kind, f.time, business.slotIntervalMinutes]);

  const submit = (force = false) => {
    if (!f.name.trim()) return toast.error("Ingresá el nombre del cliente");
    if (!option) return toast.error("Elegí servicio y vehículo");
    const minute = hhmmToMinute(f.time);
    if (minute === null) return toast.error("Hora inválida");
    start(async () => {
      const res = await createManualBookingAction({
        source: f.kind,
        serviceId: f.serviceId,
        vehicleType: f.vehicleType,
        startsAt: zonedToUtc(f.date, minute, business.timezone).toISOString(),
        customerName: f.name,
        customerPhone: f.phone,
        customerEmail: f.email,
        plate: f.plate,
        brand: f.brand,
        model: f.model,
        notes: f.notes,
        force,
      });
      if (res.ok) {
        toast.success(f.kind === "walk_in" ? "Auto ingresado" : "Turno agendado");
        onClose();
      } else if (res.code === "CAPACITY") setOverCapacity(res.error);
      else toast.error(res.error);
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={f.kind === "walk_in" ? "Llegó un auto sin turno" : "Agendar turno"}
      description={f.kind === "walk_in" ? "Queda “en lavado” y ocupa un lugar desde ahora." : "Para turnos que te piden por teléfono o en persona."}
      size="lg"
      footer={
        overCapacity ? (
          <div className="space-y-2">
            <p className="text-sm text-amber-700">{overCapacity}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setOverCapacity(null)}>
                Cambiar horario
              </Button>
              <Button onClick={() => submit(true)} loading={pending}>
                Agregar igual
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" size="lg" onClick={() => submit()} loading={pending} disabled={!available.length}>
            {f.kind === "walk_in" ? "Ingresar auto" : "Agendar turno"}
            {option ? ` · ${formatMoney(option.price)}` : ""}
          </Button>
        )
      }
    >
      {available.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Primero cargá un servicio con precio en “Servicios”.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["manual", "Turno", CalendarClock],
                ["walk_in", "Llegó ahora", Footprints],
              ] as const
            ).map(([k, l, Icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  const now = utcToZoned(new Date(), business.timezone);
                  setF({ ...f, kind: k, ...(k === "walk_in" ? { date: now.dateStr, time: minuteToHHMM(now.minute - (now.minute % 5)) } : {}) });
                  setOverCapacity(null);
                }}
                className={cn("flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-all", f.kind === k ? "border-primary bg-primary-light text-primary" : "border-line text-ink-soft")}
              >
                <Icon className="size-4" /> {l}
              </button>
            ))}
          </div>

          <Field label="Servicio" htmlFor="n-service">
            <Select
              id="n-service"
              value={f.serviceId}
              onChange={(e) => {
                const s = available.find((x) => x.id === e.target.value);
                const keep = s?.prices.some((p) => p.vehicleType === f.vehicleType);
                setF({ ...f, serviceId: e.target.value, vehicleType: keep ? f.vehicleType : (s?.prices[0]?.vehicleType ?? "auto") });
              }}
            >
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-wrap gap-2">
            {types.map((v) => {
              const p = service!.prices.find((x) => x.vehicleType === v.value)!;
              return (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setF({ ...f, vehicleType: v.value })}
                  className={cn("rounded-xl border-2 px-3 py-2 text-left transition-all", f.vehicleType === v.value ? "border-primary bg-primary-light" : "border-line")}
                >
                  <span className="block text-sm font-semibold text-ink">{v.short}</span>
                  <span className="block text-xs text-muted">
                    {formatMoney(p.price)} · {formatDuration(p.durationMinutes)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Día" htmlFor="n-date">
              <Input id="n-date" type="date" value={f.date} min={todayStr(business.timezone)} onChange={(e) => setF({ ...f, date: e.target.value })} disabled={f.kind === "walk_in"} />
            </Field>
            <Field label="Hora" htmlFor="n-time">
              <Select id="n-time" value={f.time} onChange={(e) => { setF({ ...f, time: e.target.value }); setOverCapacity(null); }}>
                {times.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre del cliente" htmlFor="n-name">
              <Input id="n-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Juan Pérez" />
            </Field>
            <Field label="Teléfono (opcional)" htmlFor="n-phone">
              <Input id="n-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="351 123 4567" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Patente" htmlFor="n-plate">
              <Input id="n-plate" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value.toUpperCase() })} placeholder="AB123CD" className="px-3 font-mono uppercase" />
            </Field>
            <Field label="Marca" htmlFor="n-brand">
              <Input id="n-brand" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className="px-3" />
            </Field>
            <Field label="Modelo" htmlFor="n-model">
              <Input id="n-model" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} className="px-3" />
            </Field>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-ink-soft">Más datos (mail, notas)</summary>
            <div className="mt-3 space-y-3">
              <Field label="Email (para avisarle)" htmlFor="n-email">
                <Input id="n-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </Field>
              <Field label="Notas" htmlFor="n-notes">
                <Textarea id="n-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              </Field>
            </div>
          </details>
        </div>
      )}
    </Sheet>
  );
}

// ─── Lista con detalle ────────────────────────────────────────────────────────

export function BookingList({ bookings, business, showDate, empty }: { bookings: BookingDTO[]; business: PanelBusiness; showDate?: boolean; empty?: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = bookings.find((b) => b.id === openId) ?? null;
  if (bookings.length === 0) return <>{empty}</>;
  return (
    <>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line shadow-soft">
        {bookings.map((b) => (
          <BookingRow key={b.id} booking={b} business={business} showDate={showDate} onOpen={() => setOpenId(b.id)} />
        ))}
      </div>
      <BookingSheet booking={open} business={business} onClose={() => setOpenId(null)} />
    </>
  );
}
