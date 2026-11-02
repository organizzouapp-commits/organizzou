import { Suspense } from "react"
import type { Metadata } from "next"

import { AgendaScreen } from "@/components/calendar/agenda-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadAgenda } from "@/features/persist/load"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Agenda" }

async function AgendaData({ nowIso }: { nowIso: string }) {
  const initial = isMock ? { events: [], tasks: [], plans: [], deadlines: [] } : await loadAgenda()
  return <AgendaScreen nowIso={nowIso} initial={initial} />
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <AgendaData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
