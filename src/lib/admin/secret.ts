import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseEnv } from "@/lib/supabase/env"

import { SECRET_KEY_HINT } from "./secret-hint"

export { SECRET_KEY_HINT }

/** True when SUPABASE_SECRET_KEY is set in the server environment (`.env.local`). The value is never read into the UI. */
export function secretKeyConfigured() {
  return Boolean(process.env.SUPABASE_SECRET_KEY)
}

/**
 * Client authenticated with the Supabase secret key: it bypasses RLS, so it is only for the admin write actions, after they
 * have re-checked is_admin(). `import "server-only"` keeps it (and the key) out of every client bundle.
 */
export function createSecretClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error(SECRET_KEY_HINT)
  const { url } = getSupabaseEnv()
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
