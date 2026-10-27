import { Suspense } from "react"
import type { Metadata } from "next"

import { FinancasScreen } from "@/components/finance/financas-screen"
import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"

export const metadata: Metadata = { title: "Finanças" }

export default function FinancasPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <FinancasScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
