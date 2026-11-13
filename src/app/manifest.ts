import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Organizzou",
    short_name: "Organizzou",
    description: "Sua vida organizada em um só lugar.",
    lang: "pt-BR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    id: "/dashboard",
    background_color: "#0C0E07",
    theme_color: "#0C0E07",
    icons: [
      { src: "/brand/organizzou-icone.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/organizzou-icone-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  }
}
