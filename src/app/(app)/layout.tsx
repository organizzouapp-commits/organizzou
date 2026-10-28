import { Suspense } from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"

import { LoadingScreen } from "@/components/organizzou/loading-screen"
import { AppBackground } from "@/components/shell/app-background"
import { AppShell } from "@/components/shell/app-shell"
import { getUserPlan } from "@/lib/plan-server"
import { bypassAuth } from "@/lib/supabase/proxy"
import { parsePlan } from "@/lib/plans"
import { getSession } from "@/lib/supabase/session"

// The app is private: keep it out of search results (robots.txt disallows /dashboard too).
export const metadata: Metadata = { robots: { index: false, follow: false } }

async function ShellLoader({ children }: { children: React.ReactNode }) {
  const { supabase, userId, email } = await getSession()

  // Independent reads: run them together.
  const [{ data: profile }, plan] = await Promise.all([
    supabase.from("profiles").select("display_name, theme").eq("id", userId).maybeSingle(),
    getUserPlan(supabase, userId),
  ])
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
      user={{ name, email }}
      theme={profile?.theme}
      plan={planNow}
      whatsappConnected={whatsappConnected}
      nowIso={new Date().toISOString()}
      sidebarOpen={sidebarOpen}
      sidebarCookie={sidebarCookie}
    >
      {children}
    </AppShell>
  )
}

// First session load / session refresh: the blocking full-page state, with the full loading logotype (after ~300 ms).
function ShellFallback() {
  return <LoadingScreen delayed />
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
