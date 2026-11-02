import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { NotasScreen } from "@/components/notes/notas-screen"
import { loadNotes } from "@/features/persist/load"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Notas e lembretes" }

async function NotesData({ nowIso }: { nowIso: string }) {
  const initial = isMock ? { folders: [], notes: [], reminders: [] } : await loadNotes()
  return <NotasScreen nowIso={nowIso} initial={initial} />
}

export default function NotasPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <NotesData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
