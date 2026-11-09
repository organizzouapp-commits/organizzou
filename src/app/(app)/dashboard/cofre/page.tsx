import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/organizzou/PageSkeleton"
import { CofreScreen } from "@/components/vault/cofre-screen"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Cofre" }

/**
 * The Cofre runs entirely in the browser (src/features/vault): this server page only tells it which account is signed in, so two accounts of
 * the same browser keep separate vaults. It reads no vault data, there is no vault table, and nothing about the vault is sent to the server.
 */
async function VaultGate() {
  const { userId } = await getSession()
  return <CofreScreen userId={userId} />
}

export default function CofrePage() {
  return (
    <Suspense fallback={<PageSkeleton layout="list" />}>
      <VaultGate />
    </Suspense>
  )
}
