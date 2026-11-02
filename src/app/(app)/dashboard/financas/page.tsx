import { Suspense } from "react"
import type { Metadata } from "next"

import { FinancasScreen } from "@/components/finance/financas-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadFinance } from "@/features/persist/load"

export const metadata: Metadata = { title: "Finanças" }

async function FinanceData({ nowIso }: { nowIso: string }) {
  const initial = await loadFinance(nowIso)
  return <FinancasScreen nowIso={nowIso} initial={initial} />
}

export default function FinancasPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <FinanceData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
