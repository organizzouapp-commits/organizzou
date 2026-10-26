import { Suspense } from "react"

import { AppShell } from "@/components/shell/app-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/supabase/session"

async function ShellLoader({ children }: { children: React.ReactNode }) {
  const { supabase, userId, email } = await getSession()

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, theme")
    .eq("id", userId)
    .maybeSingle()

  const name = profile?.display_name || email.split("@")[0] || "Você"

  return (
    <AppShell user={{ name, email }} theme={profile?.theme}>
      {children}
    </AppShell>
  )
}

function ShellFallback() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <ShellLoader>{children}</ShellLoader>
    </Suspense>
  )
}
