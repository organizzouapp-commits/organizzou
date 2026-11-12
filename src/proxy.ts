import type { NextFetchEvent, NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  return updateSession(request, event)
}

export const config = {
  matcher: [
    // Skip static files, image optimization, the PWA manifest, the service worker and brand assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
