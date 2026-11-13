import { Suspense } from "react"
import type { Metadata } from "next"

import { SettingsShell } from "@/components/settings/settings-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { loadAvatarUrl } from "@/lib/avatar-server"
import { loadPlanUsage } from "@/lib/plan-usage-server"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Configurações" }

// The open tab is read on the client from ?aba= (see SettingsShell), so changing tabs never asks the server for this page again.
async function SettingsContent() {
  const { supabase, userId, email } = await getSession()
  const { data: profile } = await supabase.from("profiles").select("display_name, phone, created_at").eq("id", userId).maybeSingle()
  const [usage, avatarUrl] = await Promise.all([loadPlanUsage(supabase), loadAvatarUrl(supabase, userId)])
  return <SettingsShell usage={usage} profile={{ displayName: profile?.display_name ?? "", email, phone: profile?.phone ?? "", createdAt: profile?.created_at ?? "", avatarUrl }} />
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-[24px]" />}>
        <SettingsContent />
      </Suspense>
    </div>
  )
}
