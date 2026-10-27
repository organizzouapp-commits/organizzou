import { Suspense } from "react"
import type { Metadata } from "next"

import { DiarioScreen } from "@/components/journal/diario-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"

export const metadata: Metadata = { title: "Diário" }

export default function DiarioPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <DiarioScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
