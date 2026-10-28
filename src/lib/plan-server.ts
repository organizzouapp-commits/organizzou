import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { parsePlan, type PlanId } from "./plans"

/**
 * The user's plan from `profiles.plan`. Falls back to "free" when the column does not exist yet (migration
 * 20260105000001_profiles_plan.sql not applied), when the row is missing, or on any error.
 */
export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<PlanId> {
  try {
    const { data, error } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle()
    if (error) return "free"
    return parsePlan((data as { plan?: unknown } | null)?.plan)
  } catch {
    return "free"
  }
}
