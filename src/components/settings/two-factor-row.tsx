"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ShieldCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { OtpInput } from "@/components/auth/otp-input"
import { FormMessage } from "@/components/organizzou/FormMessage"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { getTwoFactorStatus, sendTwoFactorCode, verifyTwoFactorCode } from "@/features/auth/two-factor-actions"
import { isCompleteCode, RESEND_COOLDOWN_SECONDS, type CodePurpose } from "@/features/auth/two-factor"

/** Turning the second step on or off needs a fresh code sent to the account's e-mail: only after it is typed does anything change. */
function CodeDialog({ purpose, onClose, onDone }: { purpose: CodePurpose | null; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const sentFor = useRef<CodePurpose | null>(null)

  const send = useCallback(async (what: CodePurpose) => {
    setError(null)
    const result = await sendTwoFactorCode(what).catch(() => ({ ok: false as const, error: "Não consegui enviar o código agora. Tente de novo.", retryAfterSeconds: undefined }))
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
    if (!purpose) {
      sentFor.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode("")
      setError(null)
      setNotice(null)
      setBusy(false)
      return
    }
    if (sentFor.current === purpose) return
    sentFor.current = purpose
    void send(purpose)
  }, [purpose, send])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  async function verify(value: string) {
    if (!purpose || busy || !isCompleteCode(value)) return
    setBusy(true)
    setError(null)
    const result = await verifyTwoFactorCode(purpose, value).catch(() => ({ ok: false as const, error: "Não consegui verificar agora. Tente de novo." }))
    setBusy(false)
    if (result.ok) {
      toast.success(purpose === "enable" ? "Verificação em duas etapas ativada." : "Verificação em duas etapas desativada.")
      onDone()
      return onClose()
    }
    setCode("")
    setError(result.error)
  }

  return (
    <ResponsiveSheet open={purpose !== null} onOpenChange={(open) => !open && onClose()} title={purpose === "disable" ? "Desativar a verificação em duas etapas" : "Ativar a verificação em duas etapas"} description="Digite o código de 6 dígitos que enviamos para o e-mail da sua conta.">
      <div className="flex flex-col gap-4 pb-1">
        {purpose ? <OtpInput value={code} onChange={setCode} onComplete={(value) => void verify(value)} disabled={busy} invalid={Boolean(error)} idPrefix="settings-otp" /> : null}
        <div aria-live="polite" className="min-h-5">
          {error ? <FormMessage kind="error">{error}</FormMessage> : notice ? <FormMessage kind="success">{notice}</FormMessage> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={cooldown > 0 || busy || !purpose} onClick={() => purpose && void send(purpose)} className="h-11 rounded-full px-5">
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
          </Button>
          <Button type="button" disabled={busy || !isCompleteCode(code)} onClick={() => void verify(code)} data-testid="two-factor-confirm" className="h-11 rounded-full bg-highlight px-6 text-highlight-foreground hover:bg-highlight/90">
            {busy ? "Verificando…" : purpose === "disable" ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  )
}

/** The row of "Verificação em duas etapas": the switch asks for a code before it changes. Returns the pieces the Row of the settings page lays out. */
export function useTwoFactor() {
  const [status, setStatus] = useState<{ enabled: boolean; available: boolean } | null>(null)
  const [purpose, setPurpose] = useState<CodePurpose | null>(null)
  const refresh = useCallback(async () => setStatus(await getTwoFactorStatus().catch(() => ({ enabled: false, available: false }))), [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const control = (
    <>
      <Switch size="lg" checked={status?.enabled ?? false} disabled={!status || !status.available} aria-label="Verificação em duas etapas" data-testid="two-factor-switch" onCheckedChange={(on) => setPurpose(on ? "enable" : "disable")} />
      <CodeDialog purpose={purpose} onClose={() => setPurpose(null)} onDone={() => void refresh()} />
    </>
  )
  const description = !status ? "Pedir um código enviado ao seu e-mail ao entrar." : !status.available ? "Ainda não está disponível neste servidor. Avise o suporte." : status.enabled ? "Ativa: ao entrar, pedimos um código enviado ao e-mail da conta." : "Pedir um código enviado ao e-mail da conta ao entrar."
  return { control, description, icon: ShieldCheckIcon }
}
