import { Suspense } from "react"
import type { Metadata } from "next"

import { RotinaScreen } from "@/components/habits/rotina-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"

export const metadata: Metadata = { title: "Rotina" }

export default function RotinaPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <RotinaScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
