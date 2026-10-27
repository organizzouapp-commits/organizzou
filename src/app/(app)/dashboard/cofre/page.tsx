import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { CofreScreen } from "@/components/vault/cofre-screen"

export const metadata: Metadata = { title: "Cofre" }

export default function CofrePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <WithNow>{(nowIso) => <CofreScreen nowIso={nowIso} />}</WithNow>
    </Suspense>
  )
}
