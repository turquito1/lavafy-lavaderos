import { whatsappLink } from "./format";
import { formatDateLong, formatTime } from "./time";

/** Avisos que el lavadero le manda al cliente desde su propio WhatsApp (link wa.me con el texto armado). */
export type WhatsAppNotice = "confirmed" | "ready" | "general";

type NoticeBooking = {
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  startsAt: string | Date;
  code: string;
  hasAccount: boolean;
};

type NoticeBusiness = { name: string; timezone: string };

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Texto del aviso. `origin` es la URL de la app (para el link al detalle del turno). */
export function whatsappNoticeText(kind: WhatsAppNotice, booking: NoticeBooking, business: NoticeBusiness, origin?: string): string {
  const start = new Date(booking.startsAt);
  const when = `${formatDateLong(start, business.timezone)} a las ${formatTime(start, business.timezone)} h`;
  const hi = `Hola ${firstName(booking.customerName)}!`;
  // El detalle del turno pide login: solo sirve si el cliente sacó el turno con su cuenta.
  const detail = origin && booking.hasAccount ? `\n\nDetalle del turno: ${origin}/turno/${booking.code}` : "";

  switch (kind) {
    case "confirmed":
      return `${hi} Te confirmamos tu turno en ${business.name} para el ${when} (${booking.serviceName}). Si necesitás cambiarlo, avisanos por acá. ¡Te esperamos! 🚗${detail}`;
    case "ready":
      return `${hi} Tu auto ya está listo ✨ Podés pasar a retirarlo por ${business.name} cuando quieras. ¡Gracias por elegirnos!`;
    case "general":
      return `${hi} Te escribimos de ${business.name} por tu turno del ${when}.`;
  }
}

/** Link de WhatsApp con el aviso, o null si el turno no tiene teléfono. */
export function whatsappNoticeLink(kind: WhatsAppNotice, booking: NoticeBooking, business: NoticeBusiness, origin?: string): string | null {
  if (!booking.customerPhone) return null;
  return whatsappLink(booking.customerPhone, whatsappNoticeText(kind, booking, business, origin));
}

/** Qué aviso corresponde según el estado del turno. */
export function noticeForStatus(status: string): WhatsAppNotice {
  if (status === "ready") return "ready";
  if (status === "confirmed") return "confirmed";
  return "general";
}
