import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Only allow same-site relative paths to avoid open redirects.
function safeNext(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value
  return "/hoje"
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = safeNext(searchParams.get("next"))
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
