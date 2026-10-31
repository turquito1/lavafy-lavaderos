/**
 * Emails transaccionales (Resend). Si no hay RESEND_API_KEY, se loguean en consola.
 * Se llaman desde las server actions con `after()` para no demorar la respuesta.
 */
import "server-only";
import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessMembers, users, type Booking, type Business } from "@/db/schema";
import { formatDateLong, formatTime, utcToZoned } from "@/lib/time";
import { formatMoney, mapsLink } from "@/lib/format";
import { VEHICLE_LABEL } from "@/lib/constants";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "Lavafy <turnos@lavafy.com.ar>";
export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function send(to: string | string[] | null | undefined, subject: string, html: string) {
  const recipients = (Array.isArray(to) ? to : [to]).filter((x): x is string => !!x);
  if (recipients.length === 0) return;
  if (!resend) {
    console.info(`[email] (sin RESEND_API_KEY) → ${recipients.join(", ")} | ${subject}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to: recipients, subject, html });
    if (error) console.error("[email] error", error);
  } catch (err) {
    console.error("[email] error", err);
  }
}

async function ownerEmails(businessId: string): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(businessMembers)
    .innerJoin(users, eq(users.id, businessMembers.userId))
    .where(eq(businessMembers.businessId, businessId));
  return rows.map((r) => r.email).filter((e): e is string => !!e);
}

// ─── Plantilla ────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { title: string; intro: string; booking: Booking; business: Business; cta?: { label: string; href: string }; footer?: string }) {
  const { booking: b, business: biz } = opts;
  const when = `${formatDateLong(b.startsAt, biz.timezone)} · ${formatTime(b.startsAt, biz.timezone)} h`;
  const vehicle = [VEHICLE_LABEL[b.vehicleType], b.vehicleBrand, b.vehicleModel, b.vehiclePlate].filter(Boolean).join(" · ");
  const map = mapsLink(biz);
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:110px;vertical-align:top">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${value}</td></tr>`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <p style="margin:0 0 16px;font-weight:800;font-size:18px;color:#2563eb">Lavafy</p>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
      <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${esc(opts.title)}</h1>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.5">${opts.intro}</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
          ${row("Lavadero", esc(biz.name))}
          ${row("Cuándo", esc(when))}
          ${row("Servicio", esc(b.serviceName))}
          ${row("Vehículo", esc(vehicle))}
          ${row("Precio", esc(formatMoney(b.price)))}
          ${biz.address ? row("Dirección", map ? `<a href="${map}" style="color:#2563eb">${esc(biz.address)}${biz.city ? `, ${esc(biz.city)}` : ""}</a>` : esc(biz.address)) : ""}
          ${row("Código", `<span style="font-family:monospace;letter-spacing:2px">${esc(b.code)}</span>`)}
        </table>
      </div>
      ${opts.cta ? `<a href="${opts.cta.href}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px">${esc(opts.cta.label)}</a>` : ""}
      ${opts.footer ? `<p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.5">${opts.footer}</p>` : ""}
    </div>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:11px;text-align:center">Enviado por Lavafy · lavafy.com.ar</p>
  </div></body></html>`;
}

const bookingUrl = (b: Booking) => `${APP_URL}/turno/${b.code}`;
const panelUrl = (b: Booking, biz: Business) => `${APP_URL}/panel/agenda?fecha=${utcToZoned(b.startsAt, biz.timezone).dateStr}`;

// ─── Eventos ──────────────────────────────────────────────────────────────────

export async function notifyBookingCreated(booking: Booking, business: Business) {
  const pending = booking.status === "pending";
  const windowText =
    business.cancelWindowMinutes >= 60 ? `${Math.round(business.cancelWindowMinutes / 60)} h` : `${business.cancelWindowMinutes} min`;
  await Promise.all([
    send(
      booking.customerEmail,
      pending ? `Recibimos tu pedido de turno en ${business.name}` : `Turno confirmado en ${business.name}`,
      layout({
        title: pending ? "Tu turno está pendiente de aprobación" : "¡Tu turno está confirmado!",
        intro: pending
          ? `${esc(business.name)} va a revisar tu pedido y te avisamos por mail apenas lo confirme.`
          : "Te esperamos. Dejá el auto en el lavadero y te avisamos cuando esté listo.",
        booking,
        business,
        cta: { label: "Ver mi turno", href: bookingUrl(booking) },
        footer: `Podés cancelar o reprogramar hasta ${windowText} antes desde el link de tu turno.`,
      }),
    ),
    send(
      await ownerEmails(business.id),
      `${pending ? "Nuevo pedido de turno" : "Nuevo turno"}: ${booking.customerName} · ${formatTime(booking.startsAt, business.timezone)} h`,
      layout({
        title: pending ? "Tenés un turno para aprobar" : "Entró un turno nuevo",
        intro: `${esc(booking.customerName)}${booking.customerPhone ? ` (${esc(booking.customerPhone)})` : ""} reservó online.`,
        booking,
        business,
        cta: { label: pending ? "Aprobar en el panel" : "Ver en la agenda", href: panelUrl(booking, business) },
      }),
    ),
  ]);
}

export async function notifyBookingConfirmed(booking: Booking, business: Business) {
  await send(
    booking.customerEmail,
    `Turno confirmado en ${business.name}`,
    layout({
      title: "¡Tu turno fue confirmado!",
      intro: `${esc(business.name)} aprobó tu turno. Te esperamos.`,
      booking,
      business,
      cta: { label: "Ver mi turno", href: bookingUrl(booking) },
    }),
  );
}

export async function notifyBookingReady(booking: Booking, business: Business) {
  await send(
    booking.customerEmail,
    `Tu vehículo está listo · ${business.name}`,
    layout({
      title: "¡Tu vehículo ya está listo! 🚗✨",
      intro: `Podés pasar a retirarlo por ${esc(business.name)} cuando quieras.`,
      booking,
      business,
    }),
  );
}

export async function notifyBookingCancelled(booking: Booking, business: Business) {
  if (booking.cancelledBy === "business") {
    await send(
      booking.customerEmail,
      `Tu turno en ${business.name} fue cancelado`,
      layout({
        title: "Tu turno fue cancelado",
        intro: `${esc(business.name)} canceló el turno${booking.cancelReason ? `: “${esc(booking.cancelReason)}”` : "."} Podés sacar uno nuevo cuando quieras.`,
        booking,
        business,
        cta: { label: "Sacar otro turno", href: `${APP_URL}/${business.slug}` },
      }),
    );
  } else {
    await send(
      await ownerEmails(business.id),
      `Turno cancelado: ${booking.customerName} · ${formatTime(booking.startsAt, business.timezone)} h`,
      layout({ title: "Un cliente canceló su turno", intro: `${esc(booking.customerName)} canceló. El horario quedó libre.`, booking, business }),
    );
  }
}

export async function notifyBookingRescheduled(booking: Booking, business: Business, by: "customer" | "business") {
  if (by === "business") {
    await send(
      booking.customerEmail,
      `Tu turno en ${business.name} cambió de horario`,
      layout({
        title: "Cambiamos el horario de tu turno",
        intro: `${esc(business.name)} reprogramó tu turno. Estos son los nuevos datos:`,
        booking,
        business,
        cta: { label: "Ver mi turno", href: bookingUrl(booking) },
      }),
    );
  } else {
    await send(
      await ownerEmails(business.id),
      `Turno reprogramado: ${booking.customerName}`,
      layout({ title: "Un cliente reprogramó su turno", intro: `${esc(booking.customerName)} eligió un nuevo horario:`, booking, business }),
    );
  }
}

export async function notifyReminder(booking: Booking, business: Business) {
  await send(
    booking.customerEmail,
    `Recordatorio: hoy tenés turno en ${business.name} a las ${formatTime(booking.startsAt, business.timezone)} h`,
    layout({
      title: "Hoy tenés turno 👋",
      intro: "Te recordamos tu turno de hoy. Si no podés ir, cancelalo desde el link así liberás el lugar.",
      booking,
      business,
      cta: { label: "Ver mi turno", href: bookingUrl(booking) },
    }),
  );
}
