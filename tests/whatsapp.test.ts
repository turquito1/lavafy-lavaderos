import { describe, expect, it } from "vitest";
import { toWhatsAppNumber, whatsappLink } from "@/lib/format";
import { phoneSchema } from "@/lib/validation";
import { noticeForStatus, whatsappNoticeLink, whatsappNoticeText } from "@/lib/whatsapp-messages";

describe("toWhatsAppNumber", () => {
  it.each([
    ["351 123 4567", "5493511234567"],
    ["3511234567", "5493511234567"],
    ["0351 15 123-4567", "5493511234567"],
    ["0351-155-123456", "5493515123456"], // número que empieza con 5 (sin "15")
    ["351 15 1234567", "5493511234567"],
    ["11 15 2345 6789", "5491123456789"],
    ["011 2345-6789", "5491123456789"],
    ["3543 15 123456", "5493543123456"], // código de área de 4 dígitos
    ["+54 9 351 123 4567", "5493511234567"],
    ["+54 351 123 4567", "5493511234567"],
    ["5493511234567", "5493511234567"],
    ["0054 9 351 1234567", "5493511234567"],
    ["+598 99 123 456", "59899123456"], // Uruguay, con +
  ])("%s → %s", (input, expected) => {
    expect(toWhatsAppNumber(input)).toBe(expected);
  });

  it.each(["", "123", "1234567", "351 123 45", "+12"])("rechaza %j", (input) => {
    expect(toWhatsAppNumber(input)).toBeNull();
  });

  it("whatsappLink usa el número normalizado", () => {
    expect(whatsappLink("351 123 4567", "Hola!")).toBe("https://wa.me/5493511234567?text=Hola!");
  });
});

describe("phoneSchema", () => {
  it("guarda el número normalizado", () => {
    expect(phoneSchema.parse(" 0351 15 123 4567 ")).toBe("+5493511234567");
  });
  it("da un error claro si falta el código de área", () => {
    const res = phoneSchema.safeParse("1234567");
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.message).toMatch(/código de área/);
  });
});

describe("avisos por WhatsApp", () => {
  const business = { name: "Lavadero El Turco", timezone: "America/Argentina/Cordoba" };
  const booking = {
    customerName: "Juan Pérez",
    customerPhone: "+5493511234567",
    serviceName: "Lavado completo",
    startsAt: "2026-11-05T13:00:00.000Z", // 10:00 en Córdoba
    code: "ABC123",
    hasAccount: true,
  };

  it("confirmación con fecha, hora, servicio y link al turno", () => {
    const text = whatsappNoticeText("confirmed", booking, business, "https://lavafy.com.ar");
    expect(text).toMatch(/^Hola Juan! Te confirmamos tu turno en Lavadero El Turco/);
    expect(text).toContain("10:00");
    expect(text).toContain("Lavado completo");
    expect(text).toContain("https://lavafy.com.ar/turno/ABC123");
  });

  it("sin cuenta no manda el link al turno (pide login)", () => {
    const text = whatsappNoticeText("confirmed", { ...booking, hasAccount: false }, business, "https://lavafy.com.ar");
    expect(text).not.toContain("/turno/");
  });

  it("auto listo", () => {
    expect(whatsappNoticeText("ready", booking, business)).toMatch(/^Hola Juan! Tu auto ya está listo/);
  });

  it("sin teléfono no hay link", () => {
    expect(whatsappNoticeLink("ready", { ...booking, customerPhone: null }, business)).toBeNull();
    expect(whatsappNoticeLink("ready", booking, business)).toMatch(/^https:\/\/wa\.me\/5493511234567\?text=/);
  });

  it("aviso según estado", () => {
    expect(noticeForStatus("ready")).toBe("ready");
    expect(noticeForStatus("confirmed")).toBe("confirmed");
    expect(noticeForStatus("in_progress")).toBe("general");
  });
});
