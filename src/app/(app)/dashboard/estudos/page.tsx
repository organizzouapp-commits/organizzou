import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { EstudosScreen } from "@/components/studies/estudos-screen"
import { loadStudies } from "@/features/persist/load"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Estudos" }

async function StudiesData({ nowIso }: { nowIso: string }) {
  const initial = isMock ? { subjects: [], sessions: [], deadlines: [], decks: [], cards: [] } : await loadStudies(nowIso)
  return <EstudosScreen nowIso={nowIso} initial={initial} />
}

export default function EstudosPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <StudiesData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
