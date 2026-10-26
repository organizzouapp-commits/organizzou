import { Suspense } from "react"
import type { Metadata } from "next"

import { MetasScreen } from "@/components/goals/metas-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"

export const metadata: Metadata = { title: "Metas — Organizzou" }

export default function MetasPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <MetasScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
