import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/supabase/env"

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl()
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/politicas`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site}/cadastro`, changeFrequency: "yearly", priority: 0.6 },
  ]
}
