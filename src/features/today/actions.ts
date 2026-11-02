"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

import { getSession } from "@/lib/supabase/session"

import { normalizePrefs, PREFS_COOKIE, prefsSchema, type TodayPrefs } from "./prefs"

export type SavePrefsResult = { ok: true; stored: "db" | "cookie" } | { ok: false; error: string }

/**
 * Saves the layout of "Hoje". The cookie is always written (it is what lets the server render the right widgets); the database
 * column is written too when it exists. Until migration 20261102000001 is applied `stored` is "cookie" and nothing else changes.
 */
export async function savePrefs(input: unknown): Promise<SavePrefsResult> {
  const parsed = prefsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Preferências inválidas." }
  // Valid shape, but unknown/removed ids and duplicates are cleaned the same way as on read.
  const prefs: TodayPrefs = normalizePrefs(parsed.data)

  ;(await cookies()).set(PREFS_COOKIE, JSON.stringify(prefs), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false, secure: process.env.NODE_ENV === "production" })

  try {
    const { supabase, userId } = await getSession()
    const { error } = await (supabase as unknown as SupabaseClient).from("profiles").update({ dashboard_prefs: prefs }).eq("id", userId)
    if (!error) return { ok: true, stored: "db" }
  } catch {
    // Not signed in (prototype) or the column does not exist yet: the cookie is the store.
  }
  return { ok: true, stored: "cookie" }
}
