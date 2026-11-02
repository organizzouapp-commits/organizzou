import { Suspense } from "react"
import type { Metadata } from "next"

import { DiarioScreen } from "@/components/journal/diario-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadJournal } from "@/features/persist/load"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Diário" }

async function JournalData({ nowIso }: { nowIso: string }) {
  const initial = isMock ? [] : await loadJournal(nowIso)
  return <DiarioScreen nowIso={nowIso} initial={initial} />
}

export default function DiarioPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <JournalData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
