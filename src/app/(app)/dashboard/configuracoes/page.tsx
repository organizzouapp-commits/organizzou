import { Suspense } from "react"
import type { Metadata } from "next"

import { SettingsTabs } from "@/components/settings/settings-tabs"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Configurações" }

async function SettingsContent({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams
  return <SettingsTabs initialTab={aba} />
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
