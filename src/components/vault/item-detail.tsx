"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { HatchedProgress } from "@/components/finance/parts"
import { ActionMenu } from "@/components/organizzou/action-menu"
import { ITEM_ICONS } from "@/components/vault/item-icons"
import { useVaultActions } from "@/components/vault/use-vault-actions"
import { SMALL_CAPS, chip } from "@/components/vault/vault-kit"
import { Button } from "@/components/ui/button"
import { ageLabel } from "@/features/vault/health"
import { STRENGTH_LABELS, passwordStrength } from "@/features/vault/passwords"
import { VAULT_TYPE_LABELS, type VaultItem } from "@/features/vault/types"
import { cn } from "@/lib/utils"

const MASK = "••••••••"
/** A revealed secret hides itself again after this long. */
export const REVEAL_MS = 10_000
const ICON_BUTTON = "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
const CARD = "flex min-w-0 flex-col gap-1 rounded-[14px] border border-border p-3"
const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMM yyyy", { locale: ptBR }).replace(".", "")

/** One labelled value in its own card. A secret is masked until the eye is pressed, and hides again after 10 seconds. */
function FieldCard({ label, value, secret, copyMessage, onCopy, multiline, className }: { label: string; value: string; secret?: boolean; copyMessage?: string; onCopy?: (text: string, message: string) => void; multiline?: boolean; className?: string }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!shown) return
    const id = window.setTimeout(() => setShown(false), REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [shown])
  const hidden = secret && !shown
  return (
    <div data-row={label} className={cn(CARD, "flex-row items-center gap-2", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={SMALL_CAPS}>{label}</span>
        <span data-testid={secret ? "secret-value" : undefined} className={cn("text-[15px] leading-6 break-words", multiline && "whitespace-pre-wrap", hidden && "tracking-[0.2em]")}>
          {hidden ? MASK : value}
        </span>
      </div>
      {secret ? (
        <button type="button" aria-label={shown ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={shown} onClick={() => setShown((s) => !s)} className={ICON_BUTTON}>
          {shown ? <EyeOffIcon aria-hidden strokeWidth={1.75} className="size-4" /> : <EyeIcon aria-hidden strokeWidth={1.75} className="size-4" />}
        </button>
      ) : null}
      {copyMessage && onCopy ? (
        <button type="button" aria-label={`Copiar ${label.toLowerCase()}`} onClick={() => onCopy(value, copyMessage)} className={ICON_BUTTON}>
          <CopyIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

/** The detail of one item: the same content in the desktop panel and in the full-screen sheet of phones (where everything is stacked). */
export function ItemDetail({ item, unique, now, mobile, onEdit, onDelete }: { item: VaultItem; unique: boolean; now: Date; mobile: boolean; onEdit: () => void; onDelete: () => void }) {
  const actions = useVaultActions()
  const Icon = ITEM_ICONS[item.type]
  const copy = (text: string, message: string) => void actions.copy(text, message, item)
  const strength = item.type === "login" && item.password ? passwordStrength(item.password) : null
  const side = mobile ? "grid-cols-1" : "sm:grid-cols-2"
  const openable = item.url && /^https?:\/\//i.test(item.url)

  return (
    <div data-testid="item-detail" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border">
          <Icon strokeWidth={1.75} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-[20px] leading-7 font-semibold break-words">{item.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <span data-chip="type" className={chip}>
              {VAULT_TYPE_LABELS[item.type]}
            </span>
            <span data-chip="age" className={chip}>
              Atualizada {ageLabel(item.updated_at, now)}
            </span>
          </div>
        </div>
        {mobile ? null : (
          <ActionMenu
            ariaLabel={`Opções de ${item.name}`}
            title={item.name}
            mobile={false}
            items={[
              { label: "Editar item", icon: PencilIcon, run: onEdit },
              { label: "Excluir item", icon: Trash2Icon, run: onDelete, separated: true },
            ]}
          />
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {item.type === "login" ? (
          <>
            <div className={cn("grid gap-3", side)}>
              {item.username ? <FieldCard label="Usuário" value={item.username} copyMessage="Usuário copiado" onCopy={copy} /> : null}
              {item.password ? <FieldCard label="Senha" value={item.password} secret copyMessage="Senha copiada" onCopy={copy} /> : null}
            </div>
            {item.url ? (
              <div data-row="Site" className={cn(CARD, "flex-row items-center gap-2")}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={SMALL_CAPS}>Site</span>
                  <span className="truncate text-[15px] leading-6">{item.url}</span>
                </div>
                {openable ? (
                  <button type="button" aria-label="Abrir o site" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} className={ICON_BUTTON}>
                    <ExternalLinkIcon aria-hidden strokeWidth={1.75} className="size-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {strength ? (
              <div data-testid="strength-card" data-strength={strength} className={cn(CARD, "gap-2")}>
                <div className="flex items-center justify-between gap-2">
                  <span className={SMALL_CAPS}>Força da senha</span>
                  <span className="text-[15px] leading-6 font-semibold">{STRENGTH_LABELS[strength]}</span>
                </div>
                <HatchedProgress value={strength === "strong" ? 100 : strength === "medium" ? 66 : 33} label={`Força da senha: ${STRENGTH_LABELS[strength]}`} />
              </div>
            ) : null}
          </>
        ) : null}

        {item.type === "card" ? (
          <>
            {item.holder ? <FieldCard label="Nome no cartão" value={item.holder} /> : null}
            {item.number ? <FieldCard label="Número" value={item.number.replace(/(.{4})/g, "$1 ").trim()} secret copyMessage="Número copiado" onCopy={(t, m) => copy(t.replace(/\s+/g, ""), m)} /> : null}
            <div className={cn("grid gap-3", side)}>
              {item.expiry ? <FieldCard label="Validade" value={item.expiry} /> : null}
              {item.cvv ? <FieldCard label="Código de segurança" value={item.cvv} secret copyMessage="Código copiado" onCopy={copy} /> : null}
            </div>
          </>
        ) : null}

        {item.type === "document" && item.file ? (
          <div data-row="Arquivo" className={cn(CARD, "gap-3")}>
            <div className="flex flex-col gap-1">
              <span className={SMALL_CAPS}>Arquivo</span>
              <span className="text-[15px] leading-6 break-words">
                {item.file.name} · {item.file.size < 1024 ? `${item.file.size} B` : `${(item.file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`}
              </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" data-testid="open-file" onClick={() => void actions.openFile(item, "open")} className="h-11 flex-1 rounded-full">
                <ExternalLinkIcon strokeWidth={1.75} /> Abrir
              </Button>
              <Button type="button" variant="outline" data-testid="download-file" onClick={() => void actions.openFile(item, "download")} className="h-11 flex-1 rounded-full">
                <DownloadIcon strokeWidth={1.75} /> Baixar
              </Button>
            </div>
          </div>
        ) : null}

        {item.type === "secure_note" && item.text ? <FieldCard label="Nota" value={item.text} secret multiline copyMessage="Nota copiada" onCopy={copy} /> : null}

        {item.notes ? (
          <div data-row="Anotações" className={CARD}>
            <span className={SMALL_CAPS}>Anotações</span>
            <span className="text-[15px] leading-6 break-words whitespace-pre-wrap">{item.notes}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5" data-testid="item-chips">
          {item.created_at ? (
            <span data-chip="created" className={chip}>
              Criada em {longDate(item.created_at)}
            </span>
          ) : null}
          {item.copied_at ? (
            <span data-chip="copied" className={chip}>
              Última cópia {ageLabel(item.copied_at, now)}
            </span>
          ) : null}
          {item.type === "login" && item.password && unique ? (
            <span data-chip="unique" className={chip}>
              <CheckIcon aria-hidden strokeWidth={2} className="size-3" /> Senha única
            </span>
          ) : null}
        </div>
      </div>

      <div className={cn("flex gap-2", mobile && "sticky bottom-0 -mx-4 border-t border-border bg-popover px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]")}>
        <Button type="button" variant="outline" data-testid="edit-item" onClick={onEdit} className="h-11 flex-1 rounded-full">
          <PencilIcon strokeWidth={1.75} /> Editar
        </Button>
        <Button type="button" variant="outline" data-testid="delete-item" onClick={onDelete} className="h-11 flex-1 rounded-full">
          <Trash2Icon strokeWidth={1.75} /> Excluir
        </Button>
      </div>
    </div>
  )
}
