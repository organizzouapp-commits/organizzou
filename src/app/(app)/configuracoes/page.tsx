import { Suspense } from "react"
import type { Metadata } from "next"

import { SettingsForm } from "@/components/settings/settings-form"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Configurações — Organizzou" }

async function SettingsContent() {
  const { supabase, userId, email } = await getSession()

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()

  return <SettingsForm displayName={profile?.display_name ?? ""} email={email} />
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
        Configurações
      </h1>
      <Suspense fallback={<Skeleton className="h-72 w-full max-w-xl" />}>
        <SettingsContent />
      </Suspense>
    </div>
  )
}
