import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "./types"
import { getSupabaseEnv } from "./env"

const AUTH_PAGES = ["/entrar", "/cadastrar", "/recuperar-senha"]
const PUBLIC_PREFIXES = ["/auth", "/termos", "/privacidade", "/design-system"]

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

export async function updateSession(request: NextRequest) {
  if (bypassAuth) return NextResponse.next({ request })
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

  if (!isAuthenticated && !isPublic(pathname) && pathname !== "/") {
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
