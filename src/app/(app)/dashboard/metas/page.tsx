import { Suspense } from "react"
import type { Metadata } from "next"

import { MetasScreen } from "@/components/goals/metas-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadGoalSources, loadGoals } from "@/features/persist/load"

export const metadata: Metadata = { title: "Metas" }

async function GoalsData({ nowIso }: { nowIso: string }) {
  const [initial, sources] = await Promise.all([loadGoals(), loadGoalSources(nowIso)])
  return <MetasScreen nowIso={nowIso} initial={initial} sources={sources} />
}

export default function MetasPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <GoalsData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
