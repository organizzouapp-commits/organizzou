"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, WebAuthnAbortService } from "@simplewebauthn/browser"
import { FingerprintIcon } from "lucide-react"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { Button } from "@/components/ui/button"

type Options = Parameters<typeof startAuthentication>[0]["optionsJSON"]

async function authenticate(next: string, autofill: boolean): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  const optionsResponse = await fetch("/api/passkey/login-options", { method: "POST", cache: "no-store" })
  const body = (await optionsResponse.json().catch(() => null)) as { ok?: boolean; options?: Options; error?: string } | null
  if (!optionsResponse.ok || !body?.options) return { ok: false, error: body?.error ?? "As passkeys não estão disponíveis agora." }
  const assertion = await startAuthentication({ optionsJSON: body.options, useBrowserAutofill: autofill })
  const verified = await fetch("/api/passkey/login-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: assertion, next }) })
  const result = (await verified.json().catch(() => null)) as { ok?: boolean; next?: string; error?: string } | null
  return verified.ok && result?.ok ? { ok: true, next: result.next ?? next } : { ok: false, error: result?.error ?? "Não consegui entrar com a passkey." }
}

/**
 * "Entrar com biometria ou passkey". On browsers that support it, the e-mail field also offers the passkeys in its autofill list (conditional
 * UI), so one tap is enough. A passkey sign-in is strong on its own: no e-mail code follows.
 */
export function PasskeyLogin({ next, className, label = "Entrar com biometria ou passkey" }: { next: string; className?: string; label?: string }) {
  const router = useRouter()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(autofill: boolean) {
    setError(null)
    if (!autofill) setBusy(true)
    try {
      const result = await authenticate(next, autofill)
      if (result.ok) {
        router.replace(result.next)
        router.refresh()
        return
      }
      if (!autofill) setError(result.error)
    } catch (caught) {
      // The person closed the system sheet (a NotAllowedError) or the autofill was replaced by a click: nothing to say.
      const name = (caught as { name?: string })?.name
      if (!autofill && name !== "NotAllowedError" && name !== "AbortError") setError("Não consegui entrar com a passkey. Tente de novo ou use sua senha.")
    } finally {
      if (!autofill) setBusy(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(browserSupportsWebAuthn())
    let alive = true
    void browserSupportsWebAuthnAutofill().then((autofill) => {
      if (alive && autofill) void run(true)
    })
    return () => {
      alive = false
      WebAuthnAbortService.cancelCeremony()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (supported === false) return null
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy || supported === null}
        data-testid="passkey-login"
        onClick={() => {
          WebAuthnAbortService.cancelCeremony()
          void run(false)
        }}
        className={className ?? "h-12 w-full rounded-full"}
      >
        <FingerprintIcon strokeWidth={1.75} /> {busy ? "Aguardando o aparelho…" : label}
      </Button>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
    </div>
  )
}
