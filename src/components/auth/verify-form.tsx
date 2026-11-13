"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MailCheckIcon } from "lucide-react"

import { OtpInput } from "@/components/auth/otp-input"
import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"
import { signOut } from "@/features/auth/actions"
import { sendTwoFactorCode, verifyTwoFactorCode } from "@/features/auth/two-factor-actions"
import { isCompleteCode, RESEND_COOLDOWN_SECONDS } from "@/features/auth/two-factor"

/**
 * The second screen of the login: "Digite o código enviado para p***@gmail.com". Six boxes (autofill and paste work), "Reenviar código" after a
 * 60 s cooldown, and a way back to the login. The code is sent once when the screen opens. The server decides everything: this screen only
 * collects the digits.
 */
export function VerifyForm({ maskedEmail, next, alternative }: { maskedEmail: string; next: string; /** The "Usar outro método" button, when the person has a passkey. */ alternative?: React.ReactNode }) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const started = useRef(false)

  const send = useCallback(async () => {
    setError(null)
    const result = await sendTwoFactorCode("login").catch(() => ({ ok: false as const, error: "Não consegui enviar o código agora. Tente de novo.", retryAfterSeconds: undefined }))
    if (result.ok) {
      setNotice(`Enviamos um código para ${result.maskedEmail}.`)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } else {
      setNotice(null)
      setError(result.error)
      setCooldown(result.retryAfterSeconds ? Math.min(result.retryAfterSeconds, 900) : 10)
    }
  }, [])

  useEffect(() => {
    // One send when the screen opens (strict mode runs effects twice in development).
    if (started.current) return
    started.current = true
    void send()
  }, [send])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  async function verify(value: string) {
    if (busy || !isCompleteCode(value)) return
    setBusy(true)
    setError(null)
    const result = await verifyTwoFactorCode("login", value, next).catch(() => ({ ok: false as const, error: "Não consegui verificar agora. Tente de novo." }))
    if (result.ok) {
      router.replace(result.next)
      router.refresh()
      return
    }
    setBusy(false)
    setCode("")
    setError(result.error)
  }

  return (
    <section aria-labelledby="verify-title" data-testid="verify-card" className="flex w-full max-w-md flex-col gap-6 rounded-[24px] border border-border bg-card p-6 md:p-8">
      <div className="flex flex-col gap-2">
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full border border-border">
          <MailCheckIcon strokeWidth={1.75} className="size-5" />
        </span>
        <h1 id="verify-title" className="text-[22px] leading-8 font-semibold">
          Verificação em duas etapas
        </h1>
        <p className="text-[15px] leading-6 text-muted-foreground">
          Digite o código enviado para <strong className="font-semibold text-foreground">{maskedEmail}</strong>.
        </p>
      </div>

      <OtpInput value={code} onChange={setCode} onComplete={(value) => void verify(value)} disabled={busy} invalid={Boolean(error)} />

      <div aria-live="polite" className="min-h-5">
        {error ? <FormMessage kind="error">{error}</FormMessage> : notice ? <FormMessage kind="success">{notice}</FormMessage> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" disabled={busy || !isCompleteCode(code)} onClick={() => void verify(code)} data-testid="verify-submit" className="h-12 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90">
          {busy ? "Verificando…" : "Continuar"}
        </Button>
        <Button type="button" variant="outline" disabled={cooldown > 0 || busy} onClick={() => void send()} data-testid="verify-resend" className="h-11 rounded-full">
          {cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
        </Button>
        {alternative}
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-11 w-full rounded-full text-muted-foreground">
            Voltar ao login
          </Button>
        </form>
      </div>
    </section>
  )
}
