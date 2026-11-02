import { Suspense } from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"

import { LoadingScreen } from "@/components/organizzou/loading-screen"
import { AppBackground } from "@/components/shell/app-background"
import { AppShell } from "@/components/shell/app-shell"
import { IncludeTestToggle } from "@/components/admin/include-test-toggle"
import { requireAdmin } from "@/lib/admin/guard"

// Never indexed. (robots.txt deliberately does not mention /admin: a Disallow line would advertise the path.)
export const metadata: Metadata = { title: { absolute: "Organizzou Admin" }, robots: { index: false, follow: false } }

async function AdminShellLoader({ children }: { children: React.ReactNode }) {
  // Second lock after the proxy: non-admins get the 404 page here too.
  const { supabase, adminId, email } = await requireAdmin()

  const { data: profile } = await supabase.from("profiles").select("display_name, theme").eq("id", adminId).maybeSingle()
  const name = profile?.display_name || email.split("@")[0] || "Admin"
  // Whether this admin counts test accounts in the numbers (default: no). A missing table just means "no".
  const includeTest = ((await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient).from("admin_preferences").select("include_test").eq("admin_id", adminId).maybeSingle()).data as { include_test?: boolean } | null)?.include_test === true

  // Same per-user cookie as the app, so the sidebar keeps its expanded/collapsed choice when moving between the two.
  const sidebarCookie = `sidebar_state_${adminId.replace(/-/g, "")}`
  const stored = (await cookies()).get(sidebarCookie)?.value
  const sidebarOpen = stored === "true" ? true : stored === "false" ? false : null

  return (
    <AppShell
      nav="admin"
      isAdmin
      user={{ name, email }}
      theme={profile?.theme}
      plan="free"
      nowIso={new Date().toISOString()}
      sidebarOpen={sidebarOpen}
      sidebarCookie={sidebarCookie}
    >
      <IncludeTestToggle initial={includeTest} />
      {children}
    </AppShell>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppBackground />
      <Suspense fallback={<LoadingScreen delayed />}>
        <AdminShellLoader>{children}</AdminShellLoader>
      </Suspense>
    </>
  )
}
