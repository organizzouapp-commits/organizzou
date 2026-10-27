import { Suspense } from "react"
import type { Metadata } from "next"

import { AgendaScreen } from "@/components/calendar/agenda-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"

export const metadata: Metadata = { title: "Agenda" }

export default function AgendaPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <AgendaScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
