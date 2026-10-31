import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Lavafy · Turnos para lavaderos", template: "%s · Lavafy" },
  description: "Encontrá un lavadero cerca y sacá turno online en segundos. Para lavaderos: agenda, turnos y clientes en un solo lugar.",
  icons: { icon: [{ url: "/favicon.png", type: "image/png" }, { url: "/favicon.svg", type: "image/svg+xml" }] },
  openGraph: { siteName: "Lavafy", locale: "es_AR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
      </body>
    </html>
  );
}
