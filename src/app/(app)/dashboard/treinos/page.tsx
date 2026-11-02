import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { TreinosScreen } from "@/components/workouts/treinos-screen"
import { loadWorkouts } from "@/features/persist/load"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Treinos" }

async function WorkoutsData({ nowIso }: { nowIso: string }) {
  const initial = isMock ? { exercises: [], plans: [], planExercises: [], sessions: [], setLogs: [] } : await loadWorkouts(nowIso)
  return <TreinosScreen nowIso={nowIso} initial={initial} />
}

export default function TreinosPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <WorkoutsData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
