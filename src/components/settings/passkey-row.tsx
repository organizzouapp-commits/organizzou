"use client"

import { useCallback, useEffect, useState } from "react"
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser"
import { CheckIcon, FingerprintIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { FormMessage } from "@/components/organizzou/FormMessage"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { RowAction, SettingRow } from "@/components/settings/setting-row"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { listPasskeys, removePasskey, renamePasskey, type PasskeyRow } from "@/features/auth/passkey-actions"
import { formatDistanceToNowStrict, format } from "date-fns"
import { ptBR } from "date-fns/locale"

type Support = "checking" | "ok" | "no-webauthn" | "no-platform"

export const PASSKEY_DESCRIPTION = "Entrar com a biometria do celular ou do computador. Vale como a segunda etapa."

/**
 * The passkeys of the account. control is the Adicionar button for the Passkey row (right end of the row, full width under the text on a
 * phone); list is the registered ones as rows of the same card (inline rename, remove with a confirmation).
 */
export function usePasskeys() {
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
  const control = (
    <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void add()} data-testid="passkey-add" className="h-11 rounded-full max-sm:w-full md:h-11">
      <FingerprintIcon strokeWidth={1.75} /> {busy ? "Aguardando o aparelho…" : "Adicionar"}
    </Button>
  )
  const description = support === "no-webauthn" ? "Este navegador não suporta passkeys." : support === "no-platform" ? "Este aparelho não tem biometria ou PIN para criar uma passkey." : PASSKEY_DESCRIPTION

  const list = (
    <>
      {error ? (
        <div className="border-b border-border py-3 md:pl-14">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul aria-label="Suas passkeys" data-testid="passkeys" className="flex flex-col">
          {items.map((item) => (
            <li key={item.id} data-passkey={item.id} className="list-none">
              {renaming?.id === item.id ? (
                <form
                  className="flex min-h-16 items-center gap-2 border-b border-border py-3 last:border-b-0 last:pb-3"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    const result = await renamePasskey(item.id, renaming.label)
                    if (!result.ok) return toast.error(result.error)
                    setRenaming(null)
                    await refresh()
                  }}
                >
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40">
                    <FingerprintIcon strokeWidth={1.75} className="size-[18px]" />
                  </span>
                  <Input autoFocus value={renaming.label} maxLength={80} aria-label="Nome da passkey" onChange={(e) => setRenaming({ id: item.id, label: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} className="h-11 min-w-0 flex-1 rounded-[12px]" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="submit" variant="ghost" size="icon" aria-label="Salvar nome" className="size-11 shrink-0 rounded-full">
                        <CheckIcon strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Salvar nome</TooltipContent>
                  </Tooltip>
                  <RowAction label="Cancelar" icon={XIcon} onClick={() => setRenaming(null)} />
                </form>
              ) : (
                <SettingRow
                  interactive
                  icon={FingerprintIcon}
                  title={item.label}
                  description={
                    <span className="tabular">
                      Criada em {format(new Date(item.createdAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })} · {item.lastUsedAt ? `usada ${formatDistanceToNowStrict(new Date(item.lastUsedAt), { locale: ptBR, addSuffix: true })}` : "nunca usada"}
                    </span>
                  }
                >
                  <RowAction label={`Renomear ${item.label}`} icon={PencilIcon} onClick={() => setRenaming({ id: item.id, label: item.label })} />
                  <RowAction label={`Remover ${item.label}`} icon={Trash2Icon} onClick={() => setRemoving(item)} />
                </SettingRow>
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
    </>
  )
  return { control, description, list }
}
