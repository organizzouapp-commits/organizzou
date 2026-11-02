import { Suspense } from "react"
import type { Metadata } from "next"

import { RotinaScreen } from "@/components/habits/rotina-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadHabits } from "@/features/persist/load"

export const metadata: Metadata = { title: "Rotina" }

async function RotinaData({ nowIso }: { nowIso: string }) {
  const data = await loadHabits(nowIso)
  return <RotinaScreen nowIso={nowIso} initialHabits={data.habits} initialLogs={data.logs} />
}

export default function RotinaPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <RotinaData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
