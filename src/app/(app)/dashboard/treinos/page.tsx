import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { TreinosScreen } from "@/components/workouts/treinos-screen"

export const metadata: Metadata = { title: "Treinos" }

export default function TreinosPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <TreinosScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
