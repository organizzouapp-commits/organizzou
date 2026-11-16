import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

import { canonicalRedirect } from "@/lib/canonical-host"
import { getSiteUrl } from "@/lib/site-url"

import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // One address: www.organizzou.com and the old vercel.app host go to https://organizzou.com (308, path and query kept; production only).
  const target = canonicalRedirect({ host: request.headers.get("host"), pathname: request.nextUrl.pathname, search: request.nextUrl.search, vercelEnv: process.env.VERCEL_ENV, siteUrl: getSiteUrl() })
  if (target) return NextResponse.redirect(target, 308)
  return updateSession(request, event)
}

export const config = {
  matcher: [
    // Skip static files, image optimization, the PWA manifest, the service worker and brand assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
