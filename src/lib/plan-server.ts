import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { type Entitlements, getEntitlements, type PlanId, type PlanProfile } from "./plans"

/**
 * The person's entitlements, read from `profiles.plan`, `profiles.plan_until` and (for the 3-day grace after a failed renewal)
 * `subscriptions.grace_until`. Every missing piece (a column or a table whose migration is not applied, no row, any error) reads as the
 * Free plan, never as an error. Admins are always Pro.
 */
export async function getUserEntitlements(supabase: SupabaseClient, userId: string, isAdmin = false, now: Date = new Date()): Promise<Entitlements> {
  const profile: PlanProfile = { isAdmin }
  try {
    const withEnd = await supabase.from("profiles").select("plan, plan_until").eq("id", userId).maybeSingle()
    if (!withEnd.error) {
      const row = withEnd.data as { plan?: unknown; plan_until?: string | null } | null
      profile.plan = row?.plan
      profile.planUntil = row?.plan_until ?? null
    } else {
      const { data, error } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle()
      if (!error) profile.plan = (data as { plan?: unknown } | null)?.plan
    }
    // Only a lapsed Pro can be in grace: skip the extra read otherwise.
    if (profile.plan === "pro" && profile.planUntil && new Date(profile.planUntil).getTime() <= now.getTime()) {
      const sub = await supabase.from("subscriptions").select("grace_until").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      if (!sub.error) profile.graceUntil = (sub.data as { grace_until?: string | null } | null)?.grace_until ?? null
    }
  } catch {
    // Free
  }
  return getEntitlements(profile, now)
}

/** The plan id only (see `getUserEntitlements`). */
export async function getUserPlan(supabase: SupabaseClient, userId: string, isAdmin = false): Promise<PlanId> {
  return (await getUserEntitlements(supabase, userId, isAdmin)).plan
}
