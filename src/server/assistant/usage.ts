import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { dayOf } from "@/lib/sp-time"
import { PLANS, type PlanId } from "@/lib/plans"

/**
 * The assistant is paid for per token, so every use is counted per person per day (table `assistant_usage`) and capped by plan
 * (src/lib/plans.ts). If the table is not there yet (migration pending) the model is NOT called: an uncounted model is an unbounded bill.
 */

export const DEFAULT_MODEL = "claude-haiku-5-5"
export const assistantModel = () => process.env.ASSISTANT_MODEL?.trim() || DEFAULT_MODEL
export const assistantConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim())

export type Quota =
  | { ok: true; used: number; limit: number; remaining: number }
  | { ok: false; reason: "limit"; used: number; limit: number }
  | { ok: false; reason: "unavailable" }

const missingTable = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === "PGRST205" || error.code === "42P01" || /assistant_usage/.test(error.message ?? "")))

export async function checkQuota(supabase: SupabaseClient, userId: string, plan: PlanId, now: Date = new Date()): Promise<Quota> {
  const limit = PLANS[plan].limits.assistantMessagesPerDay ?? 200
  const { data, error } = await supabase.from("assistant_usage").select("messages").eq("user_id", userId).eq("day", dayOf(now, 0)).maybeSingle()
  if (error) return missingTable(error) ? { ok: false, reason: "unavailable" } : { ok: false, reason: "unavailable" }
  const used = (data as { messages: number } | null)?.messages ?? 0
  return used >= limit ? { ok: false, reason: "limit", used, limit } : { ok: true, used, limit, remaining: limit - used }
}

/** Adds one message and its tokens to today's counters. */
export async function recordUsage(supabase: SupabaseClient, tokens: { input: number; output: number }, now: Date = new Date(), messages = 1) {
  await supabase.rpc("assistant_bump_usage", { p_day: dayOf(now, 0), p_messages: messages, p_input: Math.max(0, Math.round(tokens.input)), p_output: Math.max(0, Math.round(tokens.output)) })
}

/** Limits that bound one reply's cost. */
export const MAX_OUTPUT_TOKENS = 700
export const MAX_HISTORY_MESSAGES = 12
export const MAX_TOOL_STEPS = 5
