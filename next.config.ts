import type { NextConfig } from "next";

/** Sent with every response. HSTS is added by Vercel itself on its domains and on custom domains. */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app does not use the camera, microphone, location, payments or USB in the browser. Turn one on here when a feature needs it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
];

/**
 * The screens run on example data (src/mocks) ONLY in the local no-login prototype (PROTOTYPE_BYPASS_AUTH=1, never in production):
 * there is no session there, so there is no database to read. Everywhere else every module reads and writes Supabase.
 * Same rule as src/lib/supabase/bypass.ts, inlined here so client components see it too.
 */
const dataMock = process.env.PROTOTYPE_BYPASS_AUTH === "1" && process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_DATA_MOCK: dataMock ? "1" : "0" },
  /* config options here */
  // A second dev server (screenshots) can use its own build folder: NEXT_DIST_DIR=.next-preview
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  images: { formats: ["image/avif", "image/webp"] },
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Old URLs -> new URLs (308, query string preserved: Next forwards it automatically).
  async redirects() {
    const permanent = true;
    return [
      { source: "/entrar", destination: "/login", permanent },
      { source: "/recuperar", destination: "/recuperar-senha", permanent },
      { source: "/redefinir-senha", destination: "/recuperar-senha/nova-senha", permanent },
      { source: "/hoje", destination: "/dashboard", permanent },
      ...["tarefas","rotina","agenda","financas","treinos","dieta","estudos","notas","metas","diario","cofre","configuracoes"].map((module) => ({
        source: `/${module}/:path*`,
        destination: `/dashboard/${module}/:path*`,
        permanent,
      })),
      { source: "/em-breve", destination: "/", permanent },
      { source: "/termos", destination: "/politicas#termos", permanent },
      { source: "/privacidade", destination: "/politicas#privacidade", permanent },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
