import { Suspense } from "react"
import type { Metadata } from "next"

import { ScreenSkeleton } from "@/components/mock/screen-skeleton"
import { WithNow } from "@/components/mock/with-now"
import { HojeScreen } from "@/components/today/hoje-screen"
import { isMock } from "@/mocks/config"
import { getSession } from "@/lib/supabase/session"

import { LiveToday } from "./live"

export const metadata: Metadata = { title: "Hoje — Organizzou" }

async function FirstName() {
  const { supabase, userId, email } = await getSession()
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle()
  return data?.display_name || email.split("@")[0] || ""
}

async function MockToday() {
  const name = await FirstName()
  return <WithNow>{(nowIso) => <HojeScreen nowIso={nowIso} name={name} />}</WithNow>
}

export default function TodayPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>{isMock ? <MockToday /> : <LiveToday />}</Suspense>
  )
}
