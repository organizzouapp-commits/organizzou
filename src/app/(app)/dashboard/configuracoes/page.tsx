import { Suspense } from "react"
import type { Metadata } from "next"

import { SettingsTabs } from "@/components/settings/settings-tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Configurações" }

async function SettingsContent({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams
  const { supabase, userId, email } = await getSession()

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()

  return <SettingsTabs displayName={profile?.display_name ?? ""} email={email} initialTab={aba} />
}

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-[24px]" />}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
