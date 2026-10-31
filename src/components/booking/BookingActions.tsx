"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { cancelMyBookingAction, rescheduleMyBookingAction } from "@/server/actions/bookings";
import type { DateException, WeeklyHour } from "@/lib/availability";
import type { VehicleType } from "@/db/schema";
import { dateStrParts } from "@/lib/time";
import { SlotPicker, type SlotValue } from "./SlotPicker";

type Props = {
  bookingId: string;
  canModify: boolean;
  windowLabel: string;
  reschedule: {
    slug: string;
    serviceId: string | null;
    vehicleType: VehicleType;
    timezone: string;
    maxDaysAhead: number;
    weekly: WeeklyHour[];
    exceptions: DateException[];
  };
};

export function BookingActions({ bookingId, canModify, windowLabel, reschedule }: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotValue>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, start] = useTransition();

  if (!canModify) {
    return <p className="text-center text-xs text-muted">Los cambios se pueden hacer hasta {windowLabel} antes del turno. Si necesitás algo, escribile al lavadero.</p>;
  }

  const doCancel = () =>
    start(async () => {
      const res = await cancelMyBookingAction(bookingId);
      if (res.ok) {
        toast.success("Turno cancelado");
        setCancelOpen(false);
      } else toast.error(res.error);
    });

  const doMove = () =>
    slot &&
    start(async () => {
      const res = await rescheduleMyBookingAction(bookingId, slot.startsAt);
      if (res.ok) {
        toast.success("¡Listo! Cambiamos el horario");
        setMoveOpen(false);
        setSlot(null);
      } else {
        toast.error(res.error);
        setSlot(null);
        setReloadKey((k) => k + 1);
      }
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {reschedule.serviceId && (
          <Button variant="secondary" icon={<CalendarClock className="size-4" />} onClick={() => setMoveOpen(true)}>
            Reprogramar
          </Button>
        )}
        <Button variant="secondary" className="text-red-600 hover:bg-red-50" icon={<XCircle className="size-4" />} onClick={() => setCancelOpen(true)}>
          Cancelar
        </Button>
      </div>

      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="¿Cancelar el turno?"
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Volver
            </Button>
            <Button variant="danger" onClick={doCancel} loading={pending}>
              Sí, cancelar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft">El horario queda libre para otra persona. Si querés, podés reprogramarlo en lugar de cancelarlo.</p>
      </Sheet>

      {reschedule.serviceId && (
        <Sheet
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          title="Elegí el nuevo horario"
          size="lg"
          footer={
            <Button className="w-full" size="lg" disabled={!slot} loading={pending} onClick={doMove}>
              {slot ? `Cambiar al ${dateStrParts(slot.date).weekdayShort} ${dateStrParts(slot.date).day} · ${slot.time} h` : "Elegí un horario"}
            </Button>
          }
        >
          <SlotPicker
            slug={reschedule.slug}
            serviceId={reschedule.serviceId}
            vehicleType={reschedule.vehicleType}
            timezone={reschedule.timezone}
            maxDaysAhead={reschedule.maxDaysAhead}
            weekly={reschedule.weekly}
            exceptions={reschedule.exceptions}
            date={date}
            onDateChange={setDate}
            value={slot}
            onChange={setSlot}
            excludeBookingId={bookingId}
            reloadKey={reloadKey}
          />
        </Sheet>
      )}
    </>
  );
}
