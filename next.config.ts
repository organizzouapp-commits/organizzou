import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A second dev server (screenshots) can use its own build folder: NEXT_DIST_DIR=.next-preview
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // Authenticated users land on the dashboard; the proxy sends everyone else to /entrar.
    return [{ source: "/", destination: "/hoje", permanent: false }];
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
