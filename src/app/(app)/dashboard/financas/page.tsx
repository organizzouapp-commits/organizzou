import { Suspense } from "react"
import type { Metadata } from "next"

import { FinancasScreen } from "@/components/finance/financas-screen"
import { FinanceSkeleton } from "@/components/finance/finance-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { loadFinance } from "@/features/persist/load"

export const metadata: Metadata = { title: "Finanças" }

async function FinanceData({ nowIso }: { nowIso: string }) {
  const initial = await loadFinance(nowIso)
  return <FinancasScreen nowIso={nowIso} initial={initial} />
}

export default function FinancasPage() {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <WithNow>{(nowIso) => <FinanceData nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
