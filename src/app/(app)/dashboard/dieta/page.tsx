import { Suspense } from "react"
import type { Metadata } from "next"

import { DietaScreen } from "@/components/diet/dieta-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadDiet } from "@/features/persist/load"
import { isMock } from "@/mocks/config"

export const metadata: Metadata = { title: "Dieta" }

async function DietData({ nowIso }: { nowIso: string }) {
  const initial = isMock ? { foods: [], mealItems: [], goal: null, weights: [], water: [] } : await loadDiet(nowIso)
  return <DietaScreen nowIso={nowIso} initial={initial} />
}

export default function DietaPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <DietData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
