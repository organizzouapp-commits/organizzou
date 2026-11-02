import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { parsePlan, type PlanId } from "./plans"

/**
 * The user's plan from `profiles.plan`. Falls back to "free" when the column does not exist yet (migration
 * 20260105000001_profiles_plan.sql not applied), when the row is missing, or on any error.
 *
 * A courtesy Pro has an end date (`profiles.plan_until`, admin migration): after it the user is Free again, with no job needed.
 * While that column does not exist yet the plan is read without it.
 */
export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<PlanId> {
  try {
    const withEnd = await supabase.from("profiles").select("plan, plan_until").eq("id", userId).maybeSingle()
    if (!withEnd.error) {
      const row = withEnd.data as { plan?: unknown; plan_until?: string | null } | null
      const plan = parsePlan(row?.plan)
      if (plan === "pro" && row?.plan_until && new Date(row.plan_until).getTime() <= Date.now()) return "free"
      return plan
    }
    const { data, error } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle()
    if (error) return "free"
    return parsePlan((data as { plan?: unknown } | null)?.plan)
  } catch {
    return "free"
  }
}
