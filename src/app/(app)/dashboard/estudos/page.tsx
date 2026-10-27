import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { EstudosScreen } from "@/components/studies/estudos-screen"

export const metadata: Metadata = { title: "Estudos" }

export default function EstudosPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <EstudosScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
