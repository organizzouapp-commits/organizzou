"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeftIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, PencilIcon, SearchIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react"

import { AddPill, LIST_CARD } from "@/components/finance/parts"
import { ITEM_ICONS } from "@/components/vault/item-icons"
import { ItemSheet } from "@/components/vault/item-form"
import { useVaultActions } from "@/components/vault/use-vault-actions"
import { SMALL_CAPS, chip } from "@/components/vault/vault-kit"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { VAULT_TYPES, VAULT_TYPE_LABELS, type VaultItem, type VaultItemType } from "@/features/vault/types"
import { cn } from "@/lib/utils"

const MASK = "••••••••"

/** What a list row says under the name: never a secret. */
function subtitle(item: VaultItem): string {
  if (item.type === "login") return item.username || item.url || "Sem usuário"
  if (item.type === "card") return item.number ? `•••• ${item.number.slice(-4)}` : "Cartão"
  if (item.type === "document") return item.file?.name ?? "Documento"
  return "Nota segura"
}

type Row = { label: string; value: string; secret?: boolean; copy?: string; multiline?: boolean }

function rowsOf(item: VaultItem): Row[] {
  const rows: Row[] = []
  if (item.type === "login") {
    if (item.username) rows.push({ label: "Usuário", value: item.username, copy: "Usuário" })
    if (item.password) rows.push({ label: "Senha", value: item.password, secret: true, copy: "Senha" })
    if (item.url) rows.push({ label: "Site", value: item.url })
  }
  if (item.type === "card") {
    if (item.holder) rows.push({ label: "Nome no cartão", value: item.holder })
    if (item.number) rows.push({ label: "Número", value: item.number.replace(/(.{4})/g, "$1 ").trim(), secret: true, copy: "Número" })
    if (item.expiry) rows.push({ label: "Validade", value: item.expiry })
    if (item.cvv) rows.push({ label: "Código de segurança", value: item.cvv, secret: true, copy: "Código" })
  }
  if (item.type === "secure_note" && item.text) rows.push({ label: "Nota", value: item.text, secret: true, copy: "Nota", multiline: true })
  if (item.notes) rows.push({ label: "Anotações", value: item.notes, multiline: true })
  return rows
}

function SecretRow({ row, copy }: { row: Row; copy: (text: string, what: string) => void }) {
  const [shown, setShown] = useState(false)
  const icon = "size-4"
  const button = "relative flex size-11 shrink-0 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
  return (
    <div data-row={row.label} className="flex items-center gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={SMALL_CAPS}>{row.label}</span>
        <span data-testid={row.secret ? "secret-value" : undefined} className={cn("text-[15px] leading-6 break-words", row.multiline && "whitespace-pre-wrap", row.secret && !shown && "tracking-[0.2em]")}>
          {row.secret && !shown ? MASK : row.value}
        </span>
      </div>
      {row.secret ? (
        <button type="button" aria-label={shown ? `Ocultar ${row.label.toLowerCase()}` : `Mostrar ${row.label.toLowerCase()}`} aria-pressed={shown} onClick={() => setShown((s) => !s)} className={button}>
          {shown ? <EyeOffIcon aria-hidden strokeWidth={1.75} className={icon} /> : <EyeIcon aria-hidden strokeWidth={1.75} className={icon} />}
        </button>
      ) : null}
      {row.copy ? (
        <button type="button" aria-label={`Copiar ${row.label.toLowerCase()}`} onClick={() => copy(row.value.replace(/\s+/g, row.label === "Número" ? "" : " "), row.copy ?? row.label)} className={button}>
          <CopyIcon aria-hidden strokeWidth={1.75} className={icon} />
        </button>
      ) : null}
    </div>
  )
}

function ItemDetail({ item, onEdit, onDelete }: { item: VaultItem; onEdit: () => void; onDelete: () => void }) {
  const actions = useVaultActions()
  const Icon = ITEM_ICONS[item.type]
  const rows = rowsOf(item)
  return (
    <div data-testid="item-detail" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border">
          <Icon strokeWidth={1.75} className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-[20px] leading-7 font-semibold break-words">{item.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <span data-chip className={chip}>
              {VAULT_TYPE_LABELS[item.type]}
            </span>
            <span className="text-[13px] leading-5 text-muted-foreground">atualizado em {format(parseISO(item.updated_at), "d 'de' MMM yyyy", { locale: ptBR }).replace(".", "")}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" data-testid="edit-item" onClick={onEdit} className="h-11 flex-1 rounded-full">
          <PencilIcon strokeWidth={1.75} /> Editar
        </Button>
        <Button type="button" variant="outline" data-testid="delete-item" onClick={onDelete} className="h-11 flex-1 rounded-full">
          <Trash2Icon strokeWidth={1.75} /> Excluir
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {item.type === "document" && item.file ? (
          <div data-row="Arquivo" className="flex flex-col gap-3 border-b border-border py-3">
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
        {rows.map((row) => (
          <SecretRow key={row.label} row={row} copy={(text, what) => void actions.copy(text, what)} />
        ))}
        {rows.length === 0 && item.type !== "document" ? <p className="py-3 text-[14px] text-muted-foreground">Este item não tem campos preenchidos.</p> : null}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ the tab

export function ItemsTab({ items, adding, onAddingChange }: { items: VaultItem[]; adding: boolean; onAddingChange: (open: boolean) => void }) {
  const actions = useVaultActions()
  const wide = useMediaQuery("(min-width: 1280px)")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | VaultItemType>("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editing, setEditing] = useState<VaultItem | null>(null)
  const [toDelete, setToDelete] = useState<VaultItem | null>(null)

  const q = query.trim().toLowerCase()
  // Search looks only at names and non-secret details, never at passwords, card numbers or note text.
  const visible = items
    .filter((i) => (filter === "all" || i.type === filter) && (!q || `${i.name} ${i.username ?? ""} ${i.url ?? ""} ${i.file?.name ?? ""}`.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  const open = items.find((i) => i.id === openId) ?? (wide ? visible[0] : undefined) ?? null
  const counts = (type: "all" | VaultItemType) => (type === "all" ? items.length : items.filter((i) => i.type === type).length)

  const detail = open ? <ItemDetail key={open.id} item={open} onEdit={() => setEditing(open)} onDelete={() => setToDelete(open)} /> : null

  const list = (
    <section aria-label="Itens do Cofre" data-testid="vault-list" className="flex min-h-0 min-w-0 flex-col gap-3 rounded-[20px] border border-border bg-card p-4">
      <div className="relative">
        <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar itens" aria-label="Buscar itens" autoComplete="off" data-testid="vault-search" className="h-11 w-full rounded-full border border-input bg-transparent pr-4 pl-10 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
      </div>
      <PillTabs kind="tabs" ariaLabel="Filtrar por tipo" items={[{ id: "all", label: "Todos", count: counts("all") }, ...VAULT_TYPES.map((t) => ({ id: t, label: VAULT_TYPE_LABELS[t], count: counts(t) }))]} value={filter} onSelect={(item) => setFilter(item.id as "all" | VaultItemType)} itemProps={(item) => ({ "data-filter": item.id })} className="-mx-1 px-1" />
      <AddPill label="Adicionar item" onClick={() => onAddingChange(true)} />
      {items.length === 0 ? (
        <div data-testid="vault-empty" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full border border-border">
            <ShieldCheckIcon strokeWidth={1.75} className="size-5" />
          </span>
          <p className="text-[16px] leading-6 font-semibold">Seu Cofre está vazio</p>
          <p className="max-w-64 text-[13px] leading-5 text-muted-foreground">Guarde senhas, cartões, documentos e notas seguras. Tudo é criptografado aqui, no seu aparelho.</p>
          <Button type="button" onClick={() => onAddingChange(true)} className="h-11 rounded-full bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90">
            Adicionar o primeiro item
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p data-testid="vault-no-results" className="px-1 py-6 text-center text-[13px] leading-5 text-muted-foreground">
          Nada encontrado{q ? ` para “${query.trim()}”` : ""}.
        </p>
      ) : (
        <ul className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {visible.map((item) => {
            const Icon = ITEM_ICONS[item.type]
            const selected = wide && open?.id === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-item={item.id}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    setOpenId(item.id)
                    setDetailOpen(true)
                  }}
                  className={cn(LIST_CARD, "flex min-h-16 w-full items-center gap-3 p-3 text-left outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none", selected && "ring-2 ring-primary ring-inset")}
                >
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
                    <Icon strokeWidth={1.75} className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] leading-6 font-semibold">{item.name}</span>
                    <span className="truncate text-[13px] leading-5 text-muted-foreground">{subtitle(item)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  return (
    <div data-testid="vault-items" className="flex min-w-0 flex-col gap-4">
      {wide ? (
        <div className="grid h-[min(720px,calc(100dvh-14rem))] min-h-[480px] grid-cols-[minmax(320px,400px)_minmax(0,1fr)] gap-4">
          {list}
          <section aria-label="Detalhe do item" className="flex min-h-0 min-w-0 flex-col rounded-[20px] border border-border bg-card p-6">
            {detail ?? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <p className="text-[16px] leading-6 font-semibold">Selecione um item</p>
                <p className="text-[13px] leading-5 text-muted-foreground">Os detalhes aparecem aqui.</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          {list}
          <Sheet open={detailOpen && Boolean(open)} onOpenChange={setDetailOpen}>
            <SheetContent side="bottom" showCloseButton={false} className="h-dvh max-h-dvh w-full rounded-none p-0" data-testid="vault-detail-sheet">
              <SheetTitle className="sr-only">{open?.name ?? "Item"}</SheetTitle>
              <SheetDescription className="sr-only">Detalhes do item do Cofre.</SheetDescription>
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Voltar para a lista" data-testid="detail-back" onClick={() => setDetailOpen(false)} className="size-11 rounded-full">
                    <ArrowLeftIcon strokeWidth={1.75} />
                  </Button>
                </div>
                {detail}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <ItemSheet open={adding || Boolean(editing)} item={editing} defaultType={filter === "all" ? "login" : filter} onClose={() => (setEditing(null), onAddingChange(false))} onSaved={(saved) => setOpenId(saved.id)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir este item?"
        description={toDelete ? `“${toDelete.name}” será apagado do Cofre. Essa ação não pode ser desfeita.` : ""}
        onConfirm={() => {
          const item = toDelete
          setToDelete(null)
          if (!item) return
          void actions.remove(item.id).then(() => {
            setOpenId(null)
            setDetailOpen(false)
          })
        }}
      />
    </div>
  )
}
