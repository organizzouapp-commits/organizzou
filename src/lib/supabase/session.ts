import { redirect } from "next/navigation"
import { connection } from "next/server"

import { bypassAuth } from "./proxy"
import { createClient } from "./server"

/** True when the JWT claims carry app_metadata.role = "admin". */
export function isAdminClaims(claims: { app_metadata?: unknown } | null | undefined) {
  const meta = claims?.app_metadata
  return typeof meta === "object" && meta !== null && (meta as { role?: unknown }).role === "admin"
}

// Per-user data must be rendered at request time. With Cache Components,
// `connection()` marks the render as dynamic before token validation reads the clock.
export async function getSession() {
  await connection()
  const supabase = await createClient()
  if (bypassAuth) return { supabase, userId: "00000000-0000-4000-8000-000000000001", email: "visitante@organizzou.app", isAdmin: false }
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) redirect("/login")

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    // app_metadata can only be written with the secret key, so users cannot grant it to themselves.
    isAdmin: isAdminClaims(claims),
  }
}
