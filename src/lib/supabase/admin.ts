import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"
import { getSecretKey } from "@/lib/admin/secret"
import { getSupabaseEnv } from "./env"

/** Service-role client. Bypasses RLS: server-side only, never import it from a client component. */
export function createAdminClient() {
  const serviceKey = getSecretKey()
  if (!serviceKey) throw new Error("SUPABASE_SECRET_KEY não configurada.")
  const { url } = getSupabaseEnv()
  return createSupabaseClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}
