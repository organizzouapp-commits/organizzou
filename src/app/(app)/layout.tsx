import { Suspense } from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"

import { LoadingScreen } from "@/components/organizzou/loading-screen"
import { AppBackground } from "@/components/shell/app-background"
import { AppShell } from "@/components/shell/app-shell"
import type { SupabaseClient } from "@supabase/supabase-js"

import { getNotifications } from "@/features/notifications/queries"
import { getUserPlan } from "@/lib/plan-server"
import { bypassAuth } from "@/lib/supabase/proxy"
import { parsePlan } from "@/lib/plans"
import { getSession } from "@/lib/supabase/session"

// The app is private: keep it out of search results (robots.txt disallows /dashboard too).
export const metadata: Metadata = { robots: { index: false, follow: false } }

async function ShellLoader({ children }: { children: React.ReactNode }) {
  const { supabase, userId, email, isAdmin } = await getSession()

  // Independent reads: run them together.
  const loose = supabase as unknown as SupabaseClient
  const [profileResult, plan, openTasks, notifications, probe] = await Promise.all([
    supabase.from("profiles").select("display_name, theme").eq("id", userId).maybeSingle(),
    getUserPlan(supabase, userId),
    bypassAuth ? 0 : openTaskCount(supabase),
    getNotifications(loose),
    // One cheap probe: are the module tables there yet? (The database update can land after the app update.)
    loose.from("habits").select("id", { head: true, count: "exact" }),
  ])
  const dataPending = probe.error?.code === "PGRST205" || probe.error?.code === "42P01"
  let profile = profileResult.data
  // An account that has no profile (created before provisioning existed) is repaired once, here: the database function only
  // fills what is missing, for the signed-in person.
  if (!bypassAuth && !profile) {
    await supabase.rpc("provision_me")
    profile = (await supabase.from("profiles").select("display_name, theme").eq("id", userId).maybeSingle()).data
  }
  // Development only (the same switch that skips login): flip the plan and the WhatsApp state by cookie to test every sidebar state.
  const jar = await cookies()
  const planNow = bypassAuth && jar.get("dev_plan") ? parsePlan(jar.get("dev_plan")?.value) : plan
  const whatsappConnected = bypassAuth && jar.get("dev_whatsapp")?.value === "1"
  const name = profile?.display_name || email.split("@")[0] || "Você"

  // The collapsed/expanded sidebar is remembered per user in a cookie.
  const sidebarCookie = `sidebar_state_${userId.replace(/-/g, "")}`
  const stored = (await cookies()).get(sidebarCookie)?.value
  const sidebarOpen = stored === "true" ? true : stored === "false" ? false : null

  return (
    <AppShell
      nav="app"
      isAdmin={isAdmin}
      user={{ name, email }}
      theme={profile?.theme}
      plan={planNow}
      whatsappConnected={whatsappConnected}
      nowIso={new Date().toISOString()}
      openTasks={openTasks}
      notifications={notifications}
      sidebarOpen={sidebarOpen}
      sidebarCookie={sidebarCookie}
    >
      {dataPending ? <DataPendingNotice /> : null}
      {children}
    </AppShell>
  )
}

// First session load / session refresh: the blocking full-page state, with the full loading logotype (after ~300 ms).
function ShellFallback() {
  return <LoadingScreen delayed />
}

/**
 * Open tasks that are on a board the person can see: not done, not archived, and not on an archived board. The same predicate the
 * boards use, so the badge and the board lists cannot disagree about what is open.
 */
async function openTaskCount(supabase: Awaited<ReturnType<typeof getSession>>["supabase"]) {
  const boards = await supabase.from("boards").select("id").eq("archived", false)
  const ids = (boards.data ?? []).map((b) => b.id)
  if (ids.length === 0) return 0
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).is("completed_at", null).eq("archived", false).in("board_id", ids)
  return count ?? 0
}

/** Shown only while the database update for the modules has not been applied: the app says so instead of pretending to save. */
function DataPendingNotice() {
  return (
    <p role="status" className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] leading-5 text-muted-foreground">
      Os dados dos módulos ainda estão sendo preparados (uma atualização do banco está pendente). Por enquanto as telas aparecem vazias e novos registros não são salvos.
    </p>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppBackground />
      <Suspense fallback={<ShellFallback />}>
        <ShellLoader>{children}</ShellLoader>
      </Suspense>
    </>
  )
}
