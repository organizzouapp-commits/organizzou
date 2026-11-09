import "server-only"

import { getSupabaseEnv } from "@/lib/supabase/env"

const TTL_MS = 10 * 60 * 1000
let cached: { value: boolean; at: number } | null = null
let inflight: Promise<boolean> | null = null

/**
 * Whether Google sign-in is enabled in the Supabase project (its public settings). Called before every "Continuar com Google" click, i.e. in front
 * of the redirect to Google, so the answer is remembered for ten minutes per server instance (a failed check is not remembered) and concurrent
 * clicks share one request. Only the first click after a cold start pays the round trip to Supabase.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  inflight ??= fetchSetting().finally(() => {
    inflight = null
  })
  return inflight
}

async function fetchSetting(): Promise<boolean> {
  try {
    const { url, anonKey } = getSupabaseEnv()
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey }, cache: "no-store" })
    if (!response.ok) return false
    const settings = (await response.json()) as { external?: { google?: boolean } }
    const value = settings.external?.google === true
    cached = { value, at: Date.now() }
    return value
  } catch {
    return false
  }
}
