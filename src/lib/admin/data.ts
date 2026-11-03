import "server-only"

import { cache } from "react"
import { notFound } from "next/navigation"

import { requireAdmin } from "./guard"

/**
 * Typed readers for the admin SQL functions (supabase/migrations/20260201000003_admin_functions.sql). Every call runs with the
 * ADMIN'S OWN session: the functions check public.is_admin() themselves, so a missing or revoked role fails inside the database
 * even if this code were bypassed. Account data and aggregates only, never content.
 */

export type Res<T> = { ok: true; data: T } | { ok: false; error: string }

const admin = cache(requireAdmin)

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<Res<T>> {
  const { supabase } = await admin()
  const { data, error } = await supabase.schema("admin").rpc(fn, args)
  if (error) {
    if (error.message === "forbidden") notFound()
    return { ok: false, error: error.code ? `${error.code}: ${error.message}` : error.message }
  }
  return { ok: true, data: data as T }
}

export const unwrap = <T, F>(result: Res<T>, fallback: F): T | F => (result.ok ? result.data : fallback)

// ---------------------------------------------------------------------------------------------------------------------

export type OverviewStats = {
  total_users: number
  total_users_prev: number
  active_today: number
  active_yesterday: number
  active_7d: number
  active_7d_prev: number
  new_7d: number
  new_7d_prev: number
  pro_users: number
  pro_users_prev: number | null
  waitlist: number
  waitlist_prev: number
  tracking_since: string | null
}

export type SignupPoint = { day: string; signups: number }
export type ActivePoint = { day: string; dau: number; wau: number; mau: number }
export type PlanSlice = { plan: "free" | "pro"; courtesy: boolean; users: number }
export type RecentSignup = { id: string; name: string | null; email: string; created_at: string; plan: "free" | "pro" }
export type Courtesy = { user_id: string; email: string; until: string }

export const overviewStats = () => rpc<OverviewStats>("overview_stats")
export const signupsByDay = (rangeDays: number) => rpc<SignupPoint[]>("signups_by_day", { range_days: rangeDays })
export const activeUsersSeries = (rangeDays: number) => rpc<ActivePoint[]>("active_users_series", { range_days: rangeDays })
export const planDistribution = () => rpc<PlanSlice[]>("plan_distribution")
export const recentSignups = (lim = 5) => rpc<RecentSignup[]>("recent_signups", { lim })
export const activeCourtesies = () => rpc<Courtesy[]>("active_courtesies")

// ---------------------------------------------------------------------------------------------------------------------

export type UserStatus = "active" | "suspended" | "pending"

export type UserRow = {
  id: string
  name: string | null
  email: string
  plan: "free" | "pro"
  plan_until: string | null
  created_at: string
  last_seen: string | null
  provider: string
  whatsapp_linked: boolean
  status: UserStatus
  total: number
}

export type UserFilters = {
  search: string | null
  plan: "free" | "pro" | null
  status: UserStatus | null
  activity: "active" | "inactive" | null
  from: string | null
  to: string | null
  sort: "name" | "email" | "plan" | "created_at" | "last_seen"
  dir: "asc" | "desc"
}

export const USER_PAGE_SIZE = 20

export const listUsers = (filters: UserFilters, page: number, size = USER_PAGE_SIZE) =>
  rpc<UserRow[]>("list_users", {
    p_search: filters.search,
    p_plan: filters.plan,
    p_status: filters.status,
    p_activity: filters.activity,
    p_from: filters.from,
    p_to: filters.to,
    p_sort: filters.sort,
    p_dir: filters.dir,
    p_page: page,
    p_size: size,
  })

/**
 * Ids of the test accounts (the demo account and every profile marked is_test). The user list always shows them, flagged "Teste", while
 * the aggregate numbers leave them out. Until the migration that adds this function is applied the list is empty and nothing is flagged.
 */
export async function testAccountIds(): Promise<Set<string>> {
  const result = await rpc<string[]>("test_account_ids")
  return new Set(result.ok && Array.isArray(result.data) ? result.data : [])
}

export type UserDetail = {
  id: string
  email: string
  name: string | null
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  last_seen: string | null
  banned_until: string | null
  providers: string[]
  plan: "free" | "pro"
  plan_until: string | null
  has_phone: boolean
  timezone: string | null
  locale: string | null
  theme: string | null
  sessions: number
  counts: { boards: number; tasks: number; tags: number; attachments: number }
}

export const userDetail = (target: string) => rpc<UserDetail | null>("user_detail", { target })

export type PlanHistoryRow = { id: string; plan: "free" | "pro"; kind: "admin" | "courtesy" | "payment"; until: string | null; created_at: string; changed_by: string | null }
export type AuditRow = { id: string; admin_id: string | null; admin_email: string | null; action: string; target_user_id: string | null; target_email: string | null; payload: Record<string, unknown>; created_at: string }

/** Plan history and audit entries of one person. Both tables are admin-only through RLS (is_admin()). */
export async function userHistory(target: string) {
  const { supabase } = await admin()
  const [plans, audit] = await Promise.all([
    supabase.from("plan_history").select("id, plan, kind, until, created_at, changed_by").eq("user_id", target).order("created_at", { ascending: false }).limit(20),
    supabase.from("admin_audit_log").select("id, admin_id, admin_email, action, target_user_id, target_email, payload, created_at").eq("target_user_id", target).order("created_at", { ascending: false }).limit(20),
  ])
  return { plans: (plans.data ?? []) as PlanHistoryRow[], audit: (audit.data ?? []) as AuditRow[] }
}

// ---------------------------------------------------------------------------------------------------------------------

export type CohortCell = { cohort_week: string; cohort_size: number; week_offset: number; active_users: number }
export type HeatCell = { dow: number; hour: number; users: number }

export const cohortRetention = (cohorts = 12) => rpc<CohortCell[]>("cohort_retention", { cohorts })
export const activityHeatmap = (rangeDays = 30) => rpc<HeatCell[]>("activity_heatmap", { range_days: rangeDays })

export type WaitlistRow = { id: string; name: string; email: string; phone: string; source: string; created_at: string; total: number }
export type WaitlistSource = { source: string; total: number }

export const WAITLIST_PAGE_SIZE = 20

export const waitlistList = (search: string | null, source: string | null, page: number, size = WAITLIST_PAGE_SIZE) =>
  rpc<WaitlistRow[]>("waitlist_list", { p_search: search, p_source: source, p_page: page, p_size: size })
export const waitlistSummary = () => rpc<WaitlistSource[]>("waitlist_summary")

export type ModuleWeek = { feature: string; week: string; records: number; users: number }
export type ModuleAdoption = { feature: string; users: number; active_users: number }

export const moduleUsage = (weeks = 12) => rpc<ModuleWeek[]>("module_usage", { weeks })
export const moduleAdoption = () => rpc<ModuleAdoption[]>("module_adoption")

export type AssistantUsage = {
  total: number
  confirmed: number
  daily: { day: string; actions: number }[]
  by_action: { action: string; actions: number; confirmed: number }[]
  top_users: { user_id: string; email: string; actions: number }[]
}

export const assistantUsage = (rangeDays = 30) => rpc<AssistantUsage>("assistant_usage", { range_days: rangeDays })

export type IntegrationNumbers = { total_users: number; google_users: number; email_users: number; phones_informed: number; waitlist: number }

export const integrationNumbers = () => rpc<IntegrationNumbers>("integration_numbers")
export const lastMigration = () => rpc<string | null>("last_migration")

// ---------------------------------------------------------------------------------------------------------------------

export type AuditFilters = { admin: string | null; action: string | null; from: string | null; to: string | null }
export const AUDIT_PAGE_SIZE = 25

export async function listAudit(filters: AuditFilters, page: number) {
  const { supabase } = await admin()
  let query = supabase
    .from("admin_audit_log")
    .select("id, admin_id, admin_email, action, target_user_id, target_email, payload, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE - 1)
  if (filters.admin) query = query.eq("admin_email", filters.admin)
  if (filters.action) query = query.eq("action", filters.action)
  // Dates are São Paulo days (UTC-3, no daylight saving).
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00-03:00`)
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999-03:00`)
  const { data, count, error } = await query
  if (error) return { ok: false, error: error.message } as const
  return { ok: true, rows: (data ?? []) as AuditRow[], total: count ?? 0 } as const
}

/** Distinct admins and actions that already appear in the log, for the filter menus. */
export async function auditFacets() {
  const { supabase } = await admin()
  const { data } = await supabase.from("admin_audit_log").select("admin_email, action").order("created_at", { ascending: false }).limit(1000)
  const rows = (data ?? []) as { admin_email: string | null; action: string }[]
  return {
    admins: [...new Set(rows.map((r) => r.admin_email).filter((v): v is string => Boolean(v)))].sort(),
    actions: [...new Set(rows.map((r) => r.action))].sort(),
  }
}

/** Does `public.<table>` exist? (PostgREST answers PGRST205 / 42P01 when it does not.) Used for the support inbox, which is not built yet. */
export async function tableExists(table: string) {
  const { supabase } = await admin()
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1)
  if (!error) return true
  return !(error.code === "PGRST205" || error.code === "42P01")
}
