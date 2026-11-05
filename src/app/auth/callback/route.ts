import { NextResponse, type NextRequest } from "next/server"

import { SPLASH_RETURN_COOKIE, SPLASH_START_COOKIE } from "@/components/organizzou/splash/splash-boot"
import { safeNextPath } from "@/lib/safe-next"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"))
  const fromGoogle = searchParams.get("provider") === "google"
  // Provider-side failure (access denied, provider error): Supabase sends `error` / `error_description` instead of a code.
  const failure = fromGoogle || searchParams.has("error") || searchParams.has("error_description") ? "oauth" : null

  if (code && !searchParams.has("error")) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // ONE 302, straight to the final URL. If the login started the post-login splash, the return is stamped so the dashboard document
      // continues it (see lib/splash-resume.ts); the cookie is readable by the page's boot script, not httpOnly.
      const response = NextResponse.redirect(`${origin}${next}`)
      if (request.cookies.has(SPLASH_START_COOKIE)) response.cookies.set(SPLASH_RETURN_COOKIE, String(Date.now()), { path: "/", maxAge: 60, sameSite: "lax", httpOnly: false })
      return response
    }
  }

  return NextResponse.redirect(failure ? `${origin}/entrar?error=oauth` : `${origin}/entrar?erro=link`)
}
