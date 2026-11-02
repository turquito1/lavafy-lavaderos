const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function formatMoney(value: number): string {
  return money.format(value);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Normaliza una patente argentina: mayúsculas, sin espacios ni guiones. */
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const PLATE_RE = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2}|\d{3}[A-Z]{3}|[A-Z]\d{3}[A-Z]{3})$/;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const PHONE_ERROR = "Ingresá el celular con código de área (ej: 351 123 4567)";

/**
 * Pasa un teléfono al formato que usa WhatsApp (solo dígitos, con código de país).
 * Pensado para Argentina: acepta "351 123 4567", "0351 15 123-4567", "+54 9 351 1234567", etc.
 * y devuelve "5493511234567". Los números de otros países tienen que venir con "+".
 * Devuelve null si no se puede armar un número válido.
 */
export function toWhatsAppNumber(phone: string): string | null {
  const raw = phone.trim();
  let digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  let national: string;
  if (digits.startsWith("54") && (international || digits.length >= 12)) {
    national = digits.slice(2);
    if (national.startsWith("9")) national = national.slice(1);
  } else if (international) {
    // Otro país: lo dejamos como vino.
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  } else {
    national = digits;
  }

  if (national.startsWith("0")) national = national.slice(1);
  // Sacar el "15" de los celulares escritos a la antigua (código de área de 2 a 4 dígitos + 15 + número).
  if (national.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (national.slice(areaLength, areaLength + 2) === "15") {
        national = national.slice(0, areaLength) + national.slice(areaLength + 2);
        break;
      }
    }
  }
  return national.length === 10 ? `549${national}` : null;
}

export function whatsappLink(phone: string, text?: string): string {
  const number = toWhatsAppNumber(phone) ?? phone.replace(/\D/g, "");
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function mapsLink(b: { address?: string | null; city?: string | null; lat?: number | null; lng?: number | null }): string | null {
  if (b.lat != null && b.lng != null) return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
  const q = [b.address, b.city].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
