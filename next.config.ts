import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A second dev server (screenshots) can use its own build folder: NEXT_DIST_DIR=.next-preview
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  images: { formats: ["image/avif", "image/webp"] },
  partialPrefetching: true,
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
