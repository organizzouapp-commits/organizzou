import { NextResponse, type NextRequest } from "next/server"

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
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(failure ? `${origin}/entrar?error=oauth` : `${origin}/entrar?erro=link`)
}
