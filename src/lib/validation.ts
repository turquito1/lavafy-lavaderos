import { z } from "zod";
import { normalizePlate, PLATE_RE } from "./format";

export const vehicleTypeSchema = z.enum(["auto", "suv", "pickup", "moto"]);

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => v.replace(/\D/g, "").length >= 8 && v.replace(/\D/g, "").length <= 15, "Ingresá un teléfono válido");

export const plateSchema = z
  .string()
  .transform(normalizePlate)
  .refine((v) => PLATE_RE.test(v), "Patente inválida (ej: AB123CD o ABC123)");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const onlineBookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.uuid(),
  vehicleType: vehicleTypeSchema,
  startsAt: z.iso.datetime(),
  customerName: z.string().trim().min(2, "Ingresá tu nombre").max(80),
  customerPhone: phoneSchema,
  plate: plateSchema,
  brand: optionalText(40),
  model: optionalText(40),
  notes: optionalText(500),
});
export type OnlineBookingPayload = z.input<typeof onlineBookingSchema>;

export const manualBookingSchema = z.object({
  source: z.enum(["manual", "walk_in"]),
  serviceId: z.uuid(),
  vehicleType: vehicleTypeSchema,
  startsAt: z.iso.datetime(),
  customerName: z.string().trim().min(1, "Ingresá un nombre").max(80),
  customerPhone: z.string().trim().max(30).optional().nullable().transform((v) => v || null),
  customerEmail: z.union([z.email(), z.literal("")]).optional().nullable().transform((v) => v || null),
  plate: z.string().optional().nullable().transform((v) => (v ? normalizePlate(v) : null)),
  brand: optionalText(40),
  model: optionalText(40),
  notes: optionalText(500),
  force: z.boolean().optional(),
});
export type ManualBookingPayload = z.input<typeof manualBookingSchema>;

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}
