import { BookingError } from "@/server/bookings";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, code?: string): ActionResult<never> {
  return { ok: false, error, code };
}

/** Convierte errores conocidos en respuestas amigables; los desconocidos se loguean. */
export function handleError(err: unknown): ActionResult<never> {
  if (err instanceof BookingError) return fail(err.message, err.code);
  if (err && typeof err === "object" && "digest" in err) throw err; // redirect()/notFound() de Next
  console.error(err);
  return fail("Algo salió mal. Probá de nuevo en un momento.");
}
