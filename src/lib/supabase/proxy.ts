import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "./types"
import { getSupabaseEnv } from "./env"

const AUTH_PAGES = ["/entrar", "/cadastro", "/recuperar-senha"]
const PUBLIC_PREFIXES = ["/auth", "/termos", "/privacidade", "/design-system", "/em-breve"]

function isPublic(pathname: string) {
  return (
    AUTH_PAGES.includes(pathname) ||
    pathname === "/redefinir-senha" ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  )
}

/**
 * Local screenshots only: `PROTOTYPE_BYPASS_AUTH=1 npm run dev` skips the login redirect so every
 * prototype screen can be captured without an account. Ignored in production builds.
 */
export const bypassAuth = process.env.PROTOTYPE_BYPASS_AUTH === "1" && process.env.NODE_ENV !== "production"

/** SITE_COMING_SOON=true: logged-out visitors of "/" see the coming-soon page. */
const comingSoon = process.env.SITE_COMING_SOON === "true"

export async function updateSession(request: NextRequest) {
  if (bypassAuth) {
    if (request.nextUrl.pathname === "/") return NextResponse.redirect(new URL("/hoje", request.url))
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

  if (pathname === "/") {
    if (isAuthenticated) return NextResponse.redirect(new URL("/hoje", request.url))
    if (comingSoon) return NextResponse.rewrite(new URL("/em-breve", request.url), { request })
    return NextResponse.redirect(new URL("/hoje", request.url)) // the next hop sends visitors to /entrar
  }

  if (!isAuthenticated && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/entrar"
    loginUrl.search = ""
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = "/hoje"
    appUrl.search = ""
    return NextResponse.redirect(appUrl)
  }

  return response
}
