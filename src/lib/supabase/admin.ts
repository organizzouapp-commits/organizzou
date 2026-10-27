import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"
import { getSupabaseEnv } from "./env"

/** Service-role client. Bypasses RLS: server-side only, never import it from a client component. */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.")
  const { url } = getSupabaseEnv()
  return createSupabaseClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}
