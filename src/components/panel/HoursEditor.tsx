"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarOff, Copy, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Sheet } from "@/components/ui/Sheet";
import { addExceptionAction, deleteExceptionAction, saveWeeklyHoursAction } from "@/server/actions/panel";
import { dateStrParts, hhmmToMinute, minuteToHHMM, ucfirst, WEEK_ORDER, WEEKDAYS } from "@/lib/time";
import { cn } from "@/lib/format";

type Range = { start: string; end: string };
type Week = Record<number, Range[]>;

export function WeeklyHoursEditor({ initial }: { initial: { weekday: number; startMinute: number; endMinute: number }[] }) {
  const toWeek = () => {
    const w: Week = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const h of initial) w[h.weekday].push({ start: minuteToHHMM(h.startMinute), end: minuteToHHMM(h.endMinute) });
    return w;
  };
  const [week, setWeek] = useState<Week>(toWeek);
  const [pending, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(week) !== JSON.stringify(toWeek()), [week]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDay = (wd: number, ranges: Range[]) => setWeek((w) => ({ ...w, [wd]: ranges }));

  const copyToAll = (wd: number) => {
    setWeek((w) => {
      const next = { ...w };
      for (const d of WEEK_ORDER) if (d !== wd && next[d].length > 0) next[d] = w[wd].map((r) => ({ ...r }));
      return next;
    });
    toast.info(`Copiamos el horario del ${WEEKDAYS[wd].toLowerCase()} a los días abiertos`);
  };

  const save = () => {
    const ranges: { weekday: number; startMinute: number; endMinute: number }[] = [];
    for (const wd of WEEK_ORDER) {
      for (const r of week[wd]) {
        const s = hhmmToMinute(r.start);
        const e = r.end === "00:00" ? 1440 : hhmmToMinute(r.end);
        if (s === null || e === null || s >= e) return toast.error(`Revisá el horario del ${WEEKDAYS[wd].toLowerCase()}`);
        ranges.push({ weekday: wd, startMinute: s, endMinute: e });
      }
    }
    start(async () => {
      const res = await saveWeeklyHoursAction(ranges);
      if (res.ok) toast.success("Horarios guardados");
      else toast.error(res.error);
    });
  };

  return (
    <Card>
      <CardHeader title="Horario semanal" description="Cuándo abre el lavadero. Podés cargar más de un tramo por día (ej. cortás al mediodía)." />
      <div className="divide-y divide-line">
        {WEEK_ORDER.map((wd) => {
          const ranges = week[wd];
          const open = ranges.length > 0;
          return (
            <div key={wd} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
              <div className="flex w-full items-center justify-between sm:w-40 sm:pt-2.5">
                <span className={cn("font-semibold", open ? "text-ink" : "text-muted")}>{WEEKDAYS[wd]}</span>
                <span className="flex items-center gap-2 sm:hidden">
                  <span className="text-xs text-muted">{open ? "Abierto" : "Cerrado"}</span>
                  <Switch checked={open} onChange={(v) => setDay(wd, v ? [{ start: "09:00", end: "19:00" }] : [])} label={`${WEEKDAYS[wd]} abierto`} />
                </span>
              </div>
              <div className="hidden pt-2 sm:block">
                <Switch checked={open} onChange={(v) => setDay(wd, v ? [{ start: "09:00", end: "19:00" }] : [])} label={`${WEEKDAYS[wd]} abierto`} />
              </div>
              <div className="flex-1 space-y-2">
                {!open && <p className="hidden pt-2.5 text-sm text-muted sm:block">Cerrado</p>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="time" step={900} value={r.start} onChange={(e) => setDay(wd, ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="w-full min-w-0 flex-1 px-3 sm:w-32 sm:flex-none" aria-label="Desde" />
                    <span className="text-muted">a</span>
                    <Input type="time" step={900} value={r.end} onChange={(e) => setDay(wd, ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="w-full min-w-0 flex-1 px-3 sm:w-32 sm:flex-none" aria-label="Hasta" />
                    <button type="button" onClick={() => setDay(wd, ranges.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Quitar tramo">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                {open && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDay(wd, [...ranges, { start: ranges.at(-1)?.end ?? "15:00", end: "20:00" }])}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <Plus className="size-3.5" /> Agregar tramo
                    </button>
                    <button type="button" onClick={() => copyToAll(wd)} className="flex items-center gap-1 text-xs font-semibold text-ink-soft hover:underline">
                      <Copy className="size-3.5" /> Copiar a los demás días
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] flex items-center justify-end gap-3 rounded-b-2xl border-t border-line bg-white/95 px-5 py-3 backdrop-blur md:bottom-0">
        {dirty && <span className="text-xs font-medium text-amber-600">Cambios sin guardar</span>}
        <Button onClick={save} loading={pending} disabled={!dirty}>
          Guardar horarios
        </Button>
      </div>
    </Card>
  );
}

type Exception = { id: string; date: string; startMinute: number | null; endMinute: number | null; note: string | null };

export function ExceptionsManager({ exceptions, today }: { exceptions: Exception[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [closed, setClosed] = useState(true);
  const [range, setRange] = useState<Range>({ start: "09:00", end: "13:00" });
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const s = hhmmToMinute(range.start);
      const e = hhmmToMinute(range.end);
      const res = await addExceptionAction({ date, closed, startMinute: closed ? null : s, endMinute: closed ? null : e, note });
      if (res.ok) {
        toast.success("Fecha agregada");
        setOpen(false);
        setDate("");
        setNote("");
      } else toast.error(res.error);
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteExceptionAction(id);
      if (!res.ok) toast.error(res.error);
    });

  return (
    <Card>
      <CardHeader
        title="Feriados y días especiales"
        description="Cerrás un día puntual o cambiás el horario solo para esa fecha."
        action={
          <Button size="sm" variant="soft" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            Agregar
          </Button>
        }
      />
      {exceptions.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">No cargaste fechas especiales.</p>
      ) : (
        <ul className="divide-y divide-line">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-5 py-3">
              <CalendarOff className={cn("size-5 shrink-0", e.startMinute === null ? "text-red-500" : "text-amber-500")} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{ucfirst(dateStrParts(e.date).long)}</p>
                <p className="text-sm text-ink-soft">
                  {e.startMinute === null ? "Cerrado todo el día" : `Abre ${minuteToHHMM(e.startMinute)} a ${minuteToHHMM(e.endMinute!)}`}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <button onClick={() => remove(e.id)} disabled={pending} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label="Eliminar">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Agregar fecha especial"
        size="sm"
        footer={
          <Button className="w-full" onClick={add} loading={pending} disabled={!date}>
            Guardar
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Fecha" htmlFor="ex-date">
            <Input id="ex-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, l: "Cerrado" },
              { v: false, l: "Horario especial" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setClosed(o.v)}
                className={cn("h-11 rounded-xl border-2 text-sm font-semibold transition-all", closed === o.v ? "border-primary bg-primary-light text-primary" : "border-line text-ink-soft")}
              >
                {o.l}
              </button>
            ))}
          </div>
          {!closed && (
            <div className="flex items-center gap-2">
              <Input type="time" step={900} value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} className="min-w-0 flex-1" aria-label="Desde" />
              <span className="text-muted">a</span>
              <Input type="time" step={900} value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} className="min-w-0 flex-1" aria-label="Hasta" />
            </div>
          )}
          <Field label="Motivo (opcional)" htmlFor="ex-note">
            <Input id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Feriado, vacaciones…" />
          </Field>
          <p className="text-xs text-muted">Los turnos ya tomados ese día no se cancelan solos: revisalos en la agenda.</p>
        </div>
      </Sheet>
    </Card>
  );
}
