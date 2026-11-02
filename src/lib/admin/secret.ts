import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseEnv } from "@/lib/supabase/env"

import { SECRET_KEY_HINT } from "./secret-hint"

export { SECRET_KEY_HINT }

/**
 * The Supabase secret key: SUPABASE_SECRET_KEY, or the older name SUPABASE_SERVICE_ROLE_KEY as a fallback. This is the ONLY place
 * under src/ that reads either variable (a test enforces it); everything else calls this.
 */
export function getSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined
}

/** True when the secret key is set in the server environment (`.env.local`). The value is never read into the UI. */
export function secretKeyConfigured() {
  return Boolean(getSecretKey())
}

/**
 * Client authenticated with the Supabase secret key: it bypasses RLS, so it is only for the admin write actions, after they
 * have re-checked is_admin(). `import "server-only"` keeps it (and the key) out of every client bundle.
 */
export function createSecretClient(): SupabaseClient {
  const key = getSecretKey()
  if (!key) throw new Error(SECRET_KEY_HINT)
  const { url } = getSupabaseEnv()
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
