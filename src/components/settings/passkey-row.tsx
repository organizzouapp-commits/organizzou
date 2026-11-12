"use client"

import { useCallback, useEffect, useState } from "react"
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser"
import { FingerprintIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listPasskeys, removePasskey, renamePasskey, type PasskeyRow } from "@/features/auth/passkey-actions"
import { formatDistanceToNowStrict, format } from "date-fns"
import { ptBR } from "date-fns/locale"

type Support = "checking" | "ok" | "no-webauthn" | "no-platform"

/** "Adicionar" a passkey (the phone's or computer's own biometrics), and the list of them with rename and remove (with a confirmation). */
export function PasskeySection() {
  const [support, setSupport] = useState<Support>("checking")
  const [items, setItems] = useState<PasskeyRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null)
  const [removing, setRemoving] = useState<PasskeyRow | null>(null)

  const refresh = useCallback(async () => setItems(await listPasskeys().catch(() => [])), [])
  useEffect(() => {
    void (async () => {
      if (!browserSupportsWebAuthn()) return setSupport("no-webauthn")
      setSupport((await platformAuthenticatorIsAvailable().catch(() => false)) ? "ok" : "no-platform")
    })()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  async function add() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const optionsResponse = await fetch("/api/passkey/register-options", { method: "POST", cache: "no-store" })
      const body = (await optionsResponse.json().catch(() => null)) as { options?: Parameters<typeof startRegistration>[0]["optionsJSON"]; error?: string } | null
      if (!optionsResponse.ok || !body?.options) return setError(body?.error ?? "As passkeys não estão disponíveis agora.")
      const attestation = await startRegistration({ optionsJSON: body.options })
      const verified = await fetch("/api/passkey/register-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: attestation }) })
      const result = (await verified.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!verified.ok || !result?.ok) return setError(result?.error ?? "Não consegui criar a passkey.")
      toast.success("Passkey adicionada.")
      await refresh()
    } catch (caught) {
      const name = (caught as { name?: string })?.name
      if (name === "InvalidStateError") setError("Este aparelho já tem uma passkey sua.")
      else if (name !== "NotAllowedError" && name !== "AbortError") setError("Não consegui criar a passkey. Tente de novo.")
    } finally {
      setBusy(false)
    }
  }

  const disabled = support !== "ok"
  return (
    <div className="flex flex-col gap-3" data-testid="passkeys">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void add()} data-testid="passkey-add" className="h-11 rounded-full md:h-11">
          <FingerprintIcon strokeWidth={1.75} /> {busy ? "Aguardando o aparelho…" : "Adicionar"}
        </Button>
        {support === "no-webauthn" ? <span className="text-[13px] leading-5 text-muted-foreground">Este navegador não suporta passkeys.</span> : null}
        {support === "no-platform" ? <span className="text-[13px] leading-5 text-muted-foreground">Este aparelho não tem biometria ou PIN para criar uma passkey.</span> : null}
      </div>
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      {items.length > 0 ? (
        <ul aria-label="Suas passkeys" className="flex flex-col">
          {items.map((item) => (
            <li key={item.id} data-passkey={item.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2">
              {renaming?.id === item.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    const result = await renamePasskey(item.id, renaming.label)
                    if (!result.ok) return toast.error(result.error)
                    setRenaming(null)
                    await refresh()
                  }}
                >
                  <Input autoFocus value={renaming.label} maxLength={80} aria-label="Nome da passkey" onChange={(e) => setRenaming({ id: item.id, label: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} className="h-11 min-w-0 flex-1 rounded-[12px]" />
                  <Button type="submit" className="h-11 rounded-full px-4">
                    Salvar
                  </Button>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] leading-6 font-medium">{item.label}</span>
                    <span className="tabular text-[12px] leading-4 text-muted-foreground">
                      Criada em {format(new Date(item.createdAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })} · {item.lastUsedAt ? `usada ${formatDistanceToNowStrict(new Date(item.lastUsedAt), { locale: ptBR, addSuffix: true })}` : "nunca usada"}
                    </span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Renomear ${item.label}`} onClick={() => setRenaming({ id: item.id, label: item.label })} className="size-11 rounded-full">
                    <PencilIcon strokeWidth={1.75} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${item.label}`} onClick={() => setRemoving(item)} className="size-11 rounded-full">
                    <Trash2Icon strokeWidth={1.75} />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover esta passkey?"
        description={removing ? `“${removing.label}” deixa de entrar na sua conta. Você ainda pode entrar com a senha.` : ""}
        confirmLabel="Remover"
        onConfirm={async () => {
          const target = removing
          setRemoving(null)
          if (!target) return
          const result = await removePasskey(target.id)
          if (!result.ok) return toast.error(result.error)
          toast("Passkey removida.")
          await refresh()
        }}
      />
    </div>
  )
}
