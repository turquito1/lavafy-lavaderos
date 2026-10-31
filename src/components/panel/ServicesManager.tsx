"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Clock, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import type { VehicleType } from "@/db/schema";
import type { CatalogService } from "@/server/queries";
import { VEHICLE_TYPES } from "@/lib/constants";
import { cn, formatDuration, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { deleteServiceAction, moveServiceAction, saveServiceAction } from "@/server/actions/panel";

type PriceRow = { enabled: boolean; price: string; duration: string };
type FormState = { id?: string; name: string; description: string; active: boolean; prices: Record<VehicleType, PriceRow> };

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480];

function emptyForm(template?: CatalogService): FormState {
  const prices = Object.fromEntries(
    VEHICLE_TYPES.map((v) => {
      const p = template?.prices.find((x) => x.vehicleType === v.value);
      return [v.value, { enabled: template ? !!p : v.value === "auto" || v.value === "suv", price: p ? String(p.price) : "", duration: String(p?.durationMinutes ?? 60) }];
    }),
  ) as Record<VehicleType, PriceRow>;
  return { id: template?.id, name: template?.name ?? "", description: template?.description ?? "", active: template?.active ?? true, prices };
}

export function ServicesManager({ services }: { services: CatalogService[] }) {
  const [form, setForm] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<CatalogService | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    if (!form) return;
    const prices = VEHICLE_TYPES.filter((v) => form.prices[v.value].enabled).map((v) => ({
      vehicleType: v.value,
      price: Math.round(Number(form.prices[v.value].price.replace(/\D/g, ""))),
      durationMinutes: Number(form.prices[v.value].duration),
    }));
    if (prices.some((p) => !p.price && p.price !== 0)) return toast.error("Completá el precio de cada vehículo activado");
    start(async () => {
      const res = await saveServiceAction({ id: form.id, name: form.name, description: form.description, active: form.active, prices });
      if (res.ok) {
        toast.success(form.id ? "Servicio actualizado" : "Servicio creado");
        setForm(null);
      } else toast.error(res.error);
    });
  };

  const remove = () =>
    toDelete &&
    start(async () => {
      const res = await deleteServiceAction(toDelete.id);
      if (res.ok) toast.success("Servicio eliminado");
      else toast.error(res.error);
      setToDelete(null);
    });

  const move = (id: string, dir: -1 | 1) => start(async () => void (await moveServiceAction(id, dir)));

  const updatePrice = (type: VehicleType, patch: Partial<PriceRow>) =>
    setForm((f) => (f ? { ...f, prices: { ...f.prices, [type]: { ...f.prices[type], ...patch } } } : f));

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="size-4" />} onClick={() => setForm(emptyForm())}>
          Nuevo servicio
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tags className="size-6" />}
            title="Cargá tu primer servicio"
            description="Por ejemplo: Lavado exterior, Lavado completo, Lavado de motor. Cada uno con su precio y duración por tipo de vehículo."
            action={<Button onClick={() => setForm(emptyForm())}>Crear servicio</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((s, i) => (
            <Card key={s.id} className={cn("p-4 sm:p-5", !s.active && "opacity-60")}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-ink">{s.name}</h3>
                    {!s.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">Oculto</span>}
                  </div>
                  {s.description && <p className="mt-0.5 text-sm text-ink-soft">{s.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconBtn label="Subir" disabled={i === 0 || pending} onClick={() => move(s.id, -1)}>
                    <ArrowUp className="size-4" />
                  </IconBtn>
                  <IconBtn label="Bajar" disabled={i === services.length - 1 || pending} onClick={() => move(s.id, 1)}>
                    <ArrowDown className="size-4" />
                  </IconBtn>
                  <IconBtn label="Editar" onClick={() => setForm(emptyForm(s))}>
                    <Pencil className="size-4" />
                  </IconBtn>
                  <IconBtn label="Eliminar" onClick={() => setToDelete(s)} danger>
                    <Trash2 className="size-4" />
                  </IconBtn>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {s.prices.map((p) => (
                  <div key={p.vehicleType} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs text-muted">{VEHICLE_TYPES.find((v) => v.value === p.vehicleType)?.short}</p>
                    <p className="font-display font-bold text-ink">{formatMoney(p.price)}</p>
                    <p className="flex items-center gap-1 text-[11px] text-muted">
                      <Clock className="size-3" /> {formatDuration(p.durationMinutes)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar servicio" : "Nuevo servicio"}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setForm(null)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={save} loading={pending} className="flex-1">
              Guardar
            </Button>
          </div>
        }
      >
        {form && (
          <div className="space-y-4">
            <Field label="Nombre" htmlFor="sv-name">
              <Input id="sv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lavado completo" autoFocus />
            </Field>
            <Field label="Descripción (opcional)" htmlFor="sv-desc" hint="Qué incluye. La ven los clientes al reservar.">
              <Textarea id="sv-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Exterior + interior, aspirado y silicona" />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-soft">Precio y duración por vehículo</p>
              <div className="space-y-2">
                {VEHICLE_TYPES.map((v) => {
                  const row = form.prices[v.value];
                  return (
                    <div key={v.value} className={cn("rounded-xl border p-3 transition-colors", row.enabled ? "border-primary-border bg-primary-light/40" : "border-line")}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{v.label}</span>
                        <Switch checked={row.enabled} onChange={(enabled) => updatePrice(v.value, { enabled })} label={`Ofrecer para ${v.label}`} />
                      </div>
                      {row.enabled && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
                            <Input inputMode="numeric" value={row.price} onChange={(e) => updatePrice(v.value, { price: e.target.value.replace(/\D/g, "") })} placeholder="15000" className="pl-7" aria-label={`Precio ${v.label}`} />
                          </div>
                          <select
                            value={row.duration}
                            onChange={(e) => updatePrice(v.value, { duration: e.target.value })}
                            className="h-12 rounded-[10px] border border-line bg-white px-3 text-ink focus:border-primary focus:outline-none md:h-11"
                            aria-label={`Duración ${v.label}`}
                          >
                            {DURATIONS.map((d) => (
                              <option key={d} value={d}>
                                {formatDuration(d)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">La duración define cuánto tiempo ocupa un lugar en tu lavadero.</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line p-3">
              <div>
                <p className="font-semibold text-ink">Visible para reservar</p>
                <p className="text-xs text-muted">Si lo apagás, no aparece en tu página.</p>
              </div>
              <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Visible" />
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="¿Eliminar servicio?"
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Volver
            </Button>
            <Button variant="danger" onClick={remove} loading={pending}>
              Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft">
          “{toDelete?.name}” deja de estar disponible. Los turnos ya tomados se mantienen. Si solo querés pausarlo, editalo y ocultalo.
        </p>
      </Sheet>
    </>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("rounded-lg p-2 text-muted transition-colors disabled:opacity-30", danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-slate-100 hover:text-ink")}
    >
      {children}
    </button>
  );
}
