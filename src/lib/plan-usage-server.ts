import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { PlanUsage } from "./plan-usage"
import { dayOf } from "./sp-time"

/**
 * The counters behind the Plano e cobrança tab: how many task lists the person has and how many assistant messages they sent today
 * (the same `assistant_usage` counter the assistant itself is capped by). Anything that cannot be read is null, and the tab then shows only the limit.
 */
export async function loadPlanUsage(supabase: unknown, now: Date = new Date()): Promise<PlanUsage> {
  const db = supabase as SupabaseClient
  const [boards, usage] = await Promise.all([
    db.from("boards").select("id", { count: "exact", head: true }).then(
      (r) => (r.error ? null : (r.count ?? 0)),
      () => null
    ),
    db.from("assistant_usage").select("messages").eq("day", dayOf(now, 0)).maybeSingle().then(
      (r) => (r.error ? null : ((r.data as { messages: number } | null)?.messages ?? 0)),
      () => null
    ),
  ])
  return { taskBoards: boards, assistantToday: usage }
}
