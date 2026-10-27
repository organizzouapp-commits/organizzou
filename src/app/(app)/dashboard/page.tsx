import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { HojeScreen } from "@/components/today/hoje-screen"
import { isMock } from "@/mocks/config"

import { LiveToday } from "./live"

export const metadata: Metadata = { title: "Início" }

function MockToday() {
  return <WithNow>{(nowIso) => <HojeScreen nowIso={nowIso} />}</WithNow>
}

export default function TodayPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>{isMock ? <MockToday /> : <LiveToday />}</Suspense>
  )
}
