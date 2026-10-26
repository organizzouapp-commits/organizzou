import { Suspense } from "react"
import type { Metadata } from "next"

import { DietaScreen } from "@/components/diet/dieta-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"

export const metadata: Metadata = { title: "Dieta — Organizzou" }

export default function DietaPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <DietaScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
