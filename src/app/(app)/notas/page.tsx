import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { NotasScreen } from "@/components/notes/notas-screen"

export const metadata: Metadata = { title: "Notas e lembretes — Organizzou" }

export default function NotasPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <NotasScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
