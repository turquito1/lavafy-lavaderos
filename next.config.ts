import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Tailwind v4 vía el loader de Turbopack (lo configura create-next-app).
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  experimental: {
    // Las fotos llegan comprimidas desde el navegador (~200–400 KB); dejamos margen.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  async rewrites() {
    return {
      // Antes que las páginas dinámicas: si no, /landing lo tomaría la ruta [slug] de los lavaderos.
      beforeFiles: [
        // Landing del Detallado Lavafy (sitio estático en public/landing).
        { source: "/landing", destination: "/landing/index.html" },
        { source: "/landing/", destination: "/landing/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      { source: "/landing/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};

export default nextConfig;
