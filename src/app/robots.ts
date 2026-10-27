import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/supabase/env"

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl()
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/politicas", "/login", "/cadastro"],
        disallow: ["/dashboard", "/auth", "/recuperar-senha"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
