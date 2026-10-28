import { Suspense } from "react"
import type { Metadata } from "next"

import { SettingsShell } from "@/components/settings/settings-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Configurações" }

async function SettingsContent({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams
  const { supabase, userId, email } = await getSession()
  const { data: profile } = await supabase.from("profiles").select("display_name, phone").eq("id", userId).maybeSingle()
  return <SettingsShell initial={aba} profile={{ displayName: profile?.display_name ?? "", email, phone: profile?.phone ?? "" }} />
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
