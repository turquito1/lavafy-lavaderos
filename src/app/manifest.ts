import type { MetadataRoute } from "next";

/** Permite instalar Lavafy en el celu ("Agregar a pantalla de inicio"). Abre directo en la agenda. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lavafy · Turnos para lavaderos",
    short_name: "Lavafy",
    description: "Agenda y turnos online para lavaderos de autos.",
    start_url: "/panel/agenda",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
