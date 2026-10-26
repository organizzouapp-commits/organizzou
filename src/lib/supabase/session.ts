import { redirect } from "next/navigation"
import { connection } from "next/server"

import { createClient } from "./server"

// Per-user data must be rendered at request time. With Cache Components,
// `connection()` marks the render as dynamic before token validation reads the clock.
export async function getSession() {
  await connection()
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) redirect("/entrar")

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
  }
}
