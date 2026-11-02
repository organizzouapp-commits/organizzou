import { Suspense } from "react"
import type { Metadata } from "next"

import { MetasScreen } from "@/components/goals/metas-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadGoals } from "@/features/persist/load"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Metas" }

async function GoalsData({ nowIso }: { nowIso: string }) {
  const initial = isMock ? [] : await loadGoals()
  return <MetasScreen nowIso={nowIso} initial={initial} />
}

export default function MetasPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <GoalsData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
