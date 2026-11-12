import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto"

import { strongSecret } from "@/lib/auth/strong-auth"

import { canSendCode, CODE_LENGTH, CODE_TTL_MS, codeProblem, SEND_WINDOW_MS, type CodePurpose } from "./two-factor"

// Making and checking the e-mail codes. Only a salted HMAC of a code is stored, never the code; the code is never logged. `db` is the secret
// client: the two_factor_codes table has no policies for app users, so only the server can read or write it.

const memorySends = new Map<string, number[]>()

const hashOf = (code: string, salt: string) => createHmac("sha256", strongSecret() ?? "unconfigured").update(`${salt}:${code}`).digest("hex")

/** Makes a new code for the person (invalidating the older ones of this purpose) or says when they may ask again. */
export async function issueCode(db: SupabaseClient, userId: string, purpose: CodePurpose): Promise<{ ok: true; code: string } | { ok: false; retryAfterSeconds: number } | { ok: false; unavailable: true }> {
  if (!strongSecret()) return { ok: false, unavailable: true }
  const now = Date.now()
  const since = new Date(now - SEND_WINDOW_MS).toISOString()
  const stored = await db.from("two_factor_codes").select("created_at").eq("user_id", userId).gte("created_at", since)
  if (stored.error && /two_factor_codes/.test(stored.error.message)) return { ok: false, unavailable: true }
  const sent = stored.error ? (memorySends.get(userId) ?? []) : ((stored.data ?? []) as { created_at: string }[]).map((r) => Date.parse(r.created_at))
  const allowed = canSendCode(sent, now)
  if (!allowed.ok) return allowed

  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0")
  const salt = randomBytes(16).toString("hex")
  // One live code per person and purpose: the older ones are used up before the new one is stored.
  await db.from("two_factor_codes").update({ consumed_at: new Date(now).toISOString() }).eq("user_id", userId).eq("purpose", purpose).is("consumed_at", null)
  const inserted = await db.from("two_factor_codes").insert({ user_id: userId, purpose, code_hash: hashOf(code, salt), salt, expires_at: new Date(now + CODE_TTL_MS).toISOString() })
  if (inserted.error) return { ok: false, unavailable: true }
  memorySends.set(userId, [...sent, now].slice(-10))
  return { ok: true, code }
}

/** Checks a typed code: right person, right purpose, alive, under the try limit, the right digits (constant-time), and it can be used once. */
export async function checkCode(db: SupabaseClient, userId: string, purpose: CodePurpose, code: string): Promise<boolean> {
  const { data } = await db.from("two_factor_codes").select("id, code_hash, salt, expires_at, attempts, consumed_at").eq("user_id", userId).eq("purpose", purpose).is("consumed_at", null).order("created_at", { ascending: false }).limit(1)
  const row = (data ?? [])[0] as { id: string; code_hash: string; salt: string; expires_at: string; attempts: number; consumed_at: string | null } | undefined
  if (codeProblem(row ?? null, Date.now()) !== null || !row) return false
  // The try is counted BEFORE the comparison, so parallel guesses cannot get more than the limit.
  const counted = await db.from("two_factor_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id).eq("attempts", row.attempts).select("id")
  if (counted.error || (counted.data ?? []).length === 0) return false
  const given = Buffer.from(hashOf(code, row.salt), "hex")
  const wanted = Buffer.from(row.code_hash, "hex")
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return false
  // Single use: only the request that flips consumed_at from null wins.
  const used = await db.from("two_factor_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id).is("consumed_at", null).select("id")
  return (used.data ?? []).length === 1
}
