import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { TreinosScreen } from "@/components/workouts/treinos-screen"
import { loadWorkouts } from "@/features/persist/load"

export const metadata: Metadata = { title: "Treinos" }

async function WorkoutsData({ nowIso }: { nowIso: string }) {
  const initial = await loadWorkouts(nowIso)
  return <TreinosScreen nowIso={nowIso} initial={initial} />
}

export default function TreinosPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <WorkoutsData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
