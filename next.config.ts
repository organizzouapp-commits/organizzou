import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A second dev server (screenshots) can use its own build folder: NEXT_DIST_DIR=.next-preview
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  images: { formats: ["image/avif", "image/webp"] },
  partialPrefetching: true,
  // "/" is handled by the proxy: signed-in users go to /hoje, everyone else to /entrar (or /em-breve with SITE_COMING_SOON).
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
