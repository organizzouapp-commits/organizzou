import { Suspense } from "react"
import type { Metadata } from "next"

import { ProfileView } from "@/components/profile/profile-view"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Perfil" }

async function ProfileContent() {
  const { supabase, userId, email } = await getSession()
  const { data: profile } = await supabase.from("profiles").select("display_name, phone").eq("id", userId).maybeSingle()
  return <ProfileView displayName={profile?.display_name ?? ""} email={email} phone={profile?.phone ?? ""} />
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[24px]" />}>
        <ProfileContent />
      </Suspense>
    </div>
  )
}
