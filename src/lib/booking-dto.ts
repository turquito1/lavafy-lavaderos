import type { Booking } from "@/db/schema";

/** Turno serializable para mandar a componentes cliente. */
export type BookingDTO = Omit<Booking, "startsAt" | "endsAt" | "createdAt" | "updatedAt" | "cancelledAt" | "reminderSentAt" | "customerId" | "vehicleId" | "businessId"> & {
  startsAt: string;
  endsAt: string;
  createdAt: string;
  hasAccount: boolean;
};

export function toBookingDTO(b: Booking): BookingDTO {
  return {
    id: b.id,
    code: b.code,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    customerEmail: b.customerEmail,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    price: b.price,
    durationMinutes: b.durationMinutes,
    vehicleType: b.vehicleType,
    vehiclePlate: b.vehiclePlate,
    vehicleBrand: b.vehicleBrand,
    vehicleModel: b.vehicleModel,
    status: b.status,
    source: b.source,
    notes: b.notes,
    internalNotes: b.internalNotes,
    cancelledBy: b.cancelledBy,
    cancelReason: b.cancelReason,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    hasAccount: !!b.customerId,
  };
}
