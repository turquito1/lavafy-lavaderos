import type { Metadata } from "next";
import { Suspense } from "react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/Spinner";
import { PosterActions } from "@/components/panel/PosterActions";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Cartel con QR" };

export default function PosterPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { business } = await requireBusiness();
  const appUrl = (process.env.APP_URL ?? "https://lavafy.com.ar").replace(/\/$/, "");
  const url = `${appUrl}/${business.slug}`;
  const shortUrl = url.replace(/^https?:\/\//, "");
  // El QR lleva un parámetro para poder medir después cuántos turnos vienen del cartel.
  const qrTarget = `${url}?ref=qr`;
  const [svg, png] = await Promise.all([
    QRCode.toString(qrTarget, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } }),
    QRCode.toDataURL(qrTarget, { width: 1200, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8 print:max-w-none print:p-0">
      {/* Hoja A4 sin márgenes del navegador */}
      <style>{`@media print { @page { size: A4; margin: 0; } html, body { background: #fff !important; } }`}</style>

      <div className="print:hidden">
        <PageHeader
          title="Cartel con QR"
          description="Imprimilo y pegalo en el mostrador, la entrada o la sala de espera. Tus clientes escanean y sacan el próximo turno solos."
        />
        <div className="mb-6">
          <PosterActions pngDataUrl={png} fileName={`qr-${business.slug}.png`} />
          <p className="mt-2 text-xs text-muted">Tip: al imprimir, elegí tamaño A4 y activá “Gráficos de fondo” para que salgan los colores.</p>
        </div>
      </div>

      {/* El cartel. Los tamaños usan unidades del contenedor (cqw), así se ve igual en pantalla y en papel. */}
      <div className="flex justify-center">
        <article className="@container relative flex aspect-[210/297] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-card [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:h-[297mm] print:w-[210mm] print:max-w-none print:rounded-none print:shadow-none">
          <header className="flex flex-col items-center bg-gradient-to-br from-primary via-blue-500 to-accent px-[6cqw] pt-[5cqw] pb-[11cqw] text-center text-white">
            <div className="flex size-[13cqw] items-center justify-center overflow-hidden rounded-[4cqw] border-[0.8cqw] border-white/90 bg-white font-display text-[6.5cqw] font-extrabold text-primary">
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                business.name[0]?.toUpperCase()
              )}
            </div>
            <p className="mt-[2.5cqw] font-display text-[5cqw] leading-tight font-bold">{business.name}</p>
          </header>

          <div className="-mt-[7cqw] flex flex-1 flex-col items-center px-[8cqw] text-center">
            <h1 className="rounded-[3cqw] bg-white px-[5cqw] py-[2.2cqw] font-display text-[7cqw] leading-none font-extrabold whitespace-nowrap text-ink shadow-[0_1cqw_3cqw_rgba(15,23,42,0.12)]">
              Sacá tu turno <span className="text-primary">online</span>
            </h1>
            <p className="mt-[2.5cqw] text-[3.4cqw] text-ink-soft">Sin llamar ni esperar respuesta · en 1 minuto</p>

            <div className="mt-[4cqw] rounded-[4cqw] border-[0.6cqw] border-line bg-white p-[3cqw]">
              <div className="size-[40cqw] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
            <p className="mt-[2.5cqw] font-mono text-[3.4cqw] font-semibold tracking-tight text-ink">{shortUrl}</p>

            <ol className="mt-auto mb-[3.5cqw] grid w-full grid-cols-3 gap-[2.5cqw] pt-[4cqw]">
              {["Escaneá el QR", "Elegí día y hora", "Dejá el auto"].map((step, i) => (
                <li key={step} className="flex flex-col items-center gap-[1.5cqw] rounded-[3cqw] bg-primary-light px-[1.5cqw] py-[2.5cqw]">
                  <span className="flex size-[6.5cqw] items-center justify-center rounded-full bg-primary font-display text-[3.4cqw] font-bold text-white">{i + 1}</span>
                  <span className="text-[3.1cqw] leading-tight font-semibold text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <footer className="flex items-center justify-center gap-[1.5cqw] border-t border-line py-[2cqw] text-[2.4cqw] text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-128.webp" alt="" className="size-[3.6cqw]" />
            Turnos con <strong className="font-display text-ink">Lavafy</strong>
          </footer>
        </article>
      </div>
    </div>
  );
}
