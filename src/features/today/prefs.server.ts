import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

import { getSession } from "@/lib/supabase/session"

import { DEFAULT_PREFS, normalizePrefs, PREFS_COOKIE, parsePrefsJson, type TodayPrefs } from "./prefs"

export type PrefsSource = "db" | "cookie" | "default"

/**
 * Where the saved layout comes from, best first:
 *  1. profiles.dashboard_prefs (follows the person across devices; needs migration 20261102000001),
 *  2. the `hoje_prefs` cookie (a mirror written on every save, so the server renders the right widgets with no flash),
 *  3. the defaults. localStorage is the client-side twin of the cookie and is reconciled by the page component.
 */
export async function readPrefs(): Promise<{ prefs: TodayPrefs; source: PrefsSource }> {
  try {
    const { supabase, userId } = await getSession()
    const { data, error } = await (supabase as unknown as SupabaseClient).from("profiles").select("dashboard_prefs").eq("id", userId).maybeSingle()
    // `error` is also what a missing column looks like before the migration: fall through quietly.
    if (!error && data?.dashboard_prefs) return { prefs: normalizePrefs(data.dashboard_prefs), source: "db" }
  } catch {
    // No session or no database yet: the cookie and the defaults still work.
  }
  const fromCookie = parsePrefsJson((await cookies()).get(PREFS_COOKIE)?.value)
  return fromCookie ? { prefs: fromCookie, source: "cookie" } : { prefs: DEFAULT_PREFS, source: "default" }
}
