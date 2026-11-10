import type { NextConfig } from "next";

import { LEGACY_SETTINGS_ROUTES, settingsHref } from "./src/lib/settings-tabs";

/** Sent with every response. HSTS is added by Vercel itself on its domains and on custom domains. */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app does not use the camera, microphone, location, payments or USB in the browser. Turn one on here when a feature needs it.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
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
      // Perfil and Plano e cobrança are tabs of Configurações now (temporary: the tabs may still move).
      ...LEGACY_SETTINGS_ROUTES.map((route) => ({ source: route.source, destination: settingsHref(route.tab), permanent: false })),
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
