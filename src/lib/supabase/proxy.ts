import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

import { isAdminClaims } from "@/lib/admin/claims"
import { requiresSecondStep, STRONG_COOKIE, strongSecret, verifyStrongProof } from "@/lib/auth/strong-auth"
import { bypassAuth } from "./bypass"
import type { Database } from "./types"
import { getSupabaseEnv } from "./env"

// Logged-in users are sent to the dashboard from these (the new-password page is NOT here: the reset e-mail link signs them in first).
const AUTH_PAGES = ["/login", "/cadastro", "/recuperar-senha"]

/** Only the dashboard (and everything under it) needs a session; every other route is public. */
function isProtected(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/")
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

/**
 * Local screenshots only: `PROTOTYPE_BYPASS_AUTH=1 npm run dev` skips the login redirect so every
 * prototype screen can be captured without an account. Ignored in production builds.
 */
export { bypassAuth }

/** While this cookie exists the person was already counted as "seen": last_seen_at is written at most once every 10 minutes. */
const SEEN_COOKIE = "org_seen"
const SEEN_TTL_SECONDS = 10 * 60

export async function updateSession(request: NextRequest, event?: NextFetchEvent) {
  if (bypassAuth) {
    // Same 404 as below, driven by the dev_admin cookie (there is no session in this mode).
    if (isAdminPath(request.nextUrl.pathname) && request.cookies.get("dev_admin")?.value !== "1") return NextResponse.rewrite(new URL("/not-found-admin", request.url), { status: 404 })
    return NextResponse.next({ request })
  }
  const { url, anonKey } = getSupabaseEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // getClaims validates the JWT signature and refreshes the session when needed.
  const authStart = performance.now()
  const { data } = await supabase.auth.getClaims()
  const authMs = performance.now() - authStart
  const isAuthenticated = Boolean(data?.claims)
  const { pathname } = request.nextUrl

  // /admin/** answers 404 to everyone who is not an admin (signed out or not), so the area does not reveal itself. The admin layout
  // checks again on the server, and every admin SQL function checks is_admin() a third time.
  if (isAdminPath(pathname) && !isAdminClaims(data?.claims)) {
    const notFound = NextResponse.rewrite(new URL("/not-found-admin", request.url), { status: 404 })
    response.cookies.getAll().forEach((cookie) => notFound.cookies.set(cookie))
    return notFound
  }

  if (!isAuthenticated && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  // The second step (e-mail code or passkey), enforced HERE on the server: with it switched on, every dashboard page, admin page and API call
  // answers only once a signed cookie proves this session passed it. The flag comes from the JWT's app_metadata, which only the server can set.
  const sessionClaims = data?.claims
  const guarded = isProtected(pathname) || isAdminPath(pathname) || (pathname.startsWith("/api/") && !pathname.startsWith("/api/cron/"))
  if (isAuthenticated && guarded && requiresSecondStep(sessionClaims)) {
    const proven = await verifyStrongProof(strongSecret(), request.cookies.get(STRONG_COOKIE)?.value, String(sessionClaims?.sub), String((sessionClaims as { session_id?: unknown } | undefined)?.session_id ?? ""))
    if (!proven) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "second_step_required" }, { status: 401 })
      const verifyUrl = request.nextUrl.clone()
      verifyUrl.pathname = "/verificar"
      verifyUrl.search = ""
      verifyUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
      const redirect = NextResponse.redirect(verifyUrl)
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      return redirect
    }
  }

  if (!isAuthenticated && pathname === "/verificar") {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = "/dashboard"
    appUrl.search = ""
    return NextResponse.redirect(appUrl)
  }

  // Activity tracking for the admin metrics (migration 20260201000002). Real page loads only (no prefetch, no RSC data fetch), and only while the throttle cookie
  // has expired, so a busy session writes once per 10 minutes. The write runs after the response (waitUntil): it never slows a page.
  const claims = data?.claims
  const isPageLoad = request.method === "GET" && !request.headers.has("next-router-prefetch") && !request.headers.has("rsc")
  if (claims?.sub && isPageLoad && (isProtected(pathname) || isAdminPath(pathname)) && !request.cookies.has(SEEN_COOKIE)) {
    // touch_activity() sets profiles.last_seen_at and records the hour, scoped to auth.uid(). Errors (e.g. migration not applied yet) are ignored.
    const write = (supabase as unknown as SupabaseClient).rpc("touch_activity")
    event?.waitUntil(Promise.resolve(write).then(() => undefined, () => undefined))
    response.cookies.set(SEEN_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SEEN_TTL_SECONDS, path: "/" })
  }

  // The middleware's own part of the request (the session check), visible in the browser's Network tab.
  response.headers.set("Server-Timing", `auth;desc="proxy getClaims";dur=${authMs.toFixed(1)}`)
  return response
}
