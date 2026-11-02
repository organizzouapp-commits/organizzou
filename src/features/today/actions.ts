"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { z } from "zod"

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
    // `.select()` tells how many rows changed: an update that matched no profile row is not a save.
    const { data, error } = await (supabase as unknown as SupabaseClient).from("profiles").update({ dashboard_prefs: prefs }).eq("id", userId).select("id")
    if (!error && data && data.length > 0) return { ok: true, stored: "db" }
  } catch {
    // Not signed in (prototype) or the column does not exist yet: the cookie is the store.
  }
  return { ok: true, stored: "cookie" }
}

// ---------------------------------------------------------------------------------------------------------------------
// What the person does on "Hoje" besides tasks (those have their own actions in src/features/tasks): each one is saved, and the
// reply says whether the database kept it, so the page can undo its optimistic change instead of pretending.

export type DoneResult = { ok: true } | { ok: false; error: string }

const SAVE_ERROR = "Não foi possível salvar."

/** The São Paulo day of this request, "yyyy-MM-dd". */
const todaySp = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())

async function signedIn() {
  const { supabase, userId } = await getSession()
  return { supabase: supabase as unknown as SupabaseClient, userId }
}

/** Sets today's quantity of a habit (1 = done for a fixed habit, 0 = not done). One log per habit per day. */
export async function saveHabitQty(input: { habitId: string; qty: number }): Promise<DoneResult> {
  const parsed = z.object({ habitId: z.uuid(), qty: z.number().min(0).max(100000) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Dados inválidos." }
  const { supabase, userId } = await signedIn()
  const day = todaySp()
  if (parsed.data.qty <= 0) {
    const { error } = await supabase.from("habit_logs").delete().eq("habit_id", parsed.data.habitId).eq("log_date", day)
    return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
  }
  const { error } = await supabase.from("habit_logs").upsert({ user_id: userId, habit_id: parsed.data.habitId, log_date: day, qty: parsed.data.qty }, { onConflict: "habit_id,log_date" })
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

/** One more glass of water today. */
export async function logWater(input: { ml: number }): Promise<DoneResult> {
  const parsed = z.object({ ml: z.number().int().min(1).max(5000) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Dados inválidos." }
  const { supabase, userId } = await signedIn()
  const { error } = await supabase.from("water_logs").insert({ user_id: userId, log_date: todaySp(), ml: parsed.data.ml })
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}

/** Today's mood. Keeps what the person already wrote in today's check-in (text, sleep). */
export async function saveMood(input: { mood: number }): Promise<DoneResult> {
  const parsed = z.object({ mood: z.number().int().min(1).max(5) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Dados inválidos." }
  const { supabase, userId } = await signedIn()
  const day = todaySp()
  const existing = await supabase.from("journal_entries").select("id").eq("entry_date", day).maybeSingle()
  const { error } = existing.data
    ? await supabase.from("journal_entries").update({ mood: parsed.data.mood }).eq("id", (existing.data as { id: string }).id)
    : await supabase.from("journal_entries").insert({ user_id: userId, entry_date: day, mood: parsed.data.mood, text: "" })
  return error ? { ok: false, error: SAVE_ERROR } : { ok: true }
}
