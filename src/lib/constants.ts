import type { BookingSource, BookingStatus, VehicleType } from "@/db/schema";

export const VEHICLE_TYPES: { value: VehicleType; label: string; short: string }[] = [
  { value: "auto", label: "Auto", short: "Auto" },
  { value: "suv", label: "SUV / Camioneta", short: "SUV" },
  { value: "pickup", label: "Pick-up / Utilitario", short: "Pick-up" },
  { value: "moto", label: "Moto", short: "Moto" },
];
export const VEHICLE_LABEL: Record<VehicleType, string> = Object.fromEntries(VEHICLE_TYPES.map((v) => [v.value, v.label])) as Record<VehicleType, string>;

export const STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; color: string; dot: string }> = {
  pending: { label: "Por aprobar", bg: "#FFFBEB", color: "#92400E", dot: "#F59E0B" },
  confirmed: { label: "Confirmado", bg: "#EFF6FF", color: "#1D4ED8", dot: "#3B82F6" },
  in_progress: { label: "Lavando", bg: "#ECFEFF", color: "#0E7490", dot: "#06B6D4" },
  ready: { label: "Listo para retirar", bg: "#F0FDF4", color: "#166534", dot: "#16A34A" },
  completed: { label: "Finalizado", bg: "#F1F5F9", color: "#475569", dot: "#94A3B8" },
  cancelled: { label: "Cancelado", bg: "#FEF2F2", color: "#B91C1C", dot: "#EF4444" },
  no_show: { label: "No vino", bg: "#FAF5FF", color: "#7E22CE", dot: "#A855F7" },
};

export const SOURCE_LABEL: Record<BookingSource, string> = { online: "Online", manual: "Cargado", walk_in: "Sin turno" };

/** Transiciones de estado permitidas desde el panel del lavadero. */
export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "no_show", "cancelled"],
  in_progress: ["ready", "completed", "confirmed"],
  ready: ["completed", "in_progress"],
  completed: ["ready"],
  cancelled: [],
  no_show: ["confirmed"],
};

export const SLOT_INTERVAL_OPTIONS = [10, 15, 20, 30, 45, 60] as const;

/** Slugs que no puede usar un lavadero porque chocan con rutas de la app. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "panel", "ingresar", "salir", "mis-turnos", "turno", "turnos", "landing", "lavaderos",
  "precios", "planes", "ayuda", "terminos", "privacidad", "_next", "static", "public", "auth", "login",
  "registro", "cuenta", "perfil", "lavafy", "app", "www", "blog", "contacto", "soporte",
]);
