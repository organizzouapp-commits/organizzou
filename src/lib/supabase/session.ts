import { redirect } from "next/navigation"
import { connection } from "next/server"

import { cookies } from "next/headers"

import { isAdminClaims } from "@/lib/admin/claims"
import { bypassAuth } from "./proxy"
import { createClient } from "./server"

// Per-user data must be rendered at request time. With Cache Components,
// `connection()` marks the render as dynamic before token validation reads the clock.
export async function getSession() {
  await connection()
  const supabase = await createClient()
  if (bypassAuth) {
    // Development only (the same switch that skips login): the dev_admin cookie shows the admin UI. It grants no data access.
    const isAdmin = (await cookies()).get("dev_admin")?.value === "1"
    return { supabase, userId: "00000000-0000-4000-8000-000000000001", email: "visitante@organizzou.app", isAdmin }
  }
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) redirect("/login")

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    isAdmin: isAdminClaims(claims),
  }
}
