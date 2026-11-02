import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { bypassAuth } from "@/lib/supabase/proxy"
import { createClient } from "@/lib/supabase/server"

import { isAdminClaims } from "./claims"

/**
 * Server-side admin check for layouts, pages and actions. Anyone who is not an admin (signed out or not) gets the 404 page, never a
 * redirect to the login: the admin area does not reveal itself. The proxy already answers 404 for /admin/**; this is the second
 * lock, and the SQL functions' is_admin() check is the third.
 */
export async function requireAdmin() {
  await connection()
  // Untyped on purpose: the admin schema and its functions are not part of the generated Database types.
  const supabase: SupabaseClient = await createClient()

  if (bypassAuth) {
    // Development only (the switch that skips login): the dev_admin cookie shows the admin UI. There is no session, so no data.
    const { cookies } = await import("next/headers")
    if ((await cookies()).get("dev_admin")?.value !== "1") notFound()
    return { supabase, adminId: "00000000-0000-4000-8000-000000000001", email: "visitante@organizzou.app" }
  }

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims || !isAdminClaims(claims)) notFound()
  return { supabase, adminId: claims.sub, email: typeof claims.email === "string" ? claims.email : "" }
}

/** For server actions: the same check, plus a round trip to the database so a revoked admin is stopped even with a live token. */
export async function requireAdminForAction() {
  const admin = await requireAdmin()
  if (bypassAuth) return admin
  const { data, error } = await admin.supabase.rpc("is_admin")
  if (error || data !== true) notFound()
  return admin
}
