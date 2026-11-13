import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { PasskeyLogin } from "@/components/auth/passkey-login"
import { VerifyForm } from "@/components/auth/verify-form"
import { hasPasskey } from "@/features/auth/passkey-actions"
import { sessionIsVerified } from "@/features/auth/two-factor-actions"
import { maskEmail } from "@/features/auth/two-factor"
import { safeNextPath } from "@/lib/safe-next"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false } }

async function Content({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { email } = await getSession()
  const { next } = await searchParams
  const target = safeNextPath(next ?? null)
  // Already verified (or the second step is off): nothing to do here.
  if (await sessionIsVerified()) redirect(target)
  const passkey = await hasPasskey()
  return <VerifyForm maskedEmail={maskEmail(email)} next={target} alternative={passkey ? <PasskeyLogin next={target} label="Usar outro método: passkey" className="h-11 w-full rounded-full" /> : null} />
}

export default function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Suspense fallback={<div aria-hidden className="h-96 w-full max-w-md rounded-[24px] border border-border bg-card" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
