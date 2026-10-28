import { Suspense } from "react"
import type { Metadata } from "next"

import { PlanoScreen } from "@/components/plan/plano-screen"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Plano Pro" }

async function PlanContent() {
  const { supabase, userId, email } = await getSession()
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle()
  return <PlanoScreen email={email} name={profile?.display_name ?? ""} />
}

export default function PlanPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-[24px]" />}>
      <PlanContent />
    </Suspense>
  )
}
