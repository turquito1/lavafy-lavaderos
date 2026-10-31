import type { NextConfig } from "next";

const landingUrl = process.env.LANDING_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Tailwind v4 vía el loader de Turbopack (lo configura create-next-app).
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  // lavafy.com.ar/landing → landing del detailing (otro proyecto de Vercel, con basePath "/landing").
  async rewrites() {
    return landingUrl
      ? [
          { source: "/landing", destination: `${landingUrl}/landing` },
          { source: "/landing/:path*", destination: `${landingUrl}/landing/:path*` },
        ]
      : [];
  },
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }];
  },
};

export default nextConfig;
