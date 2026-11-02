import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { isAdminClaims } from "@/lib/admin/claims"
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
export const bypassAuth = process.env.PROTOTYPE_BYPASS_AUTH === "1" && process.env.NODE_ENV !== "production"

export async function updateSession(request: NextRequest) {
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
  const { data } = await supabase.auth.getClaims()
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

  if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = "/dashboard"
    appUrl.search = ""
    return NextResponse.redirect(appUrl)
  }

  return response
}
