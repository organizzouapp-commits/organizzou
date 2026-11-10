"use client"

import { useState } from "react"
import { ArrowLeftIcon, SearchIcon, ShieldCheckIcon } from "lucide-react"

import { AddPill } from "@/components/finance/parts"
import { ItemDetail } from "@/components/vault/item-detail"
import { ItemRow } from "@/components/vault/item-row"
import { ItemSheet } from "@/components/vault/item-form"
import { useRestoreFocus } from "@/hooks/use-restore-focus"
import { useVaultActions } from "@/components/vault/use-vault-actions"
import { VaultSummary } from "@/components/vault/vault-summary"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMediaQuery } from "@/hooks/use-media-query"
import { vaultHealth } from "@/features/vault/health"
import { touch } from "@/features/vault/session"
import { VAULT_TYPES, type VaultItem, type VaultItemType } from "@/features/vault/types"

const FILTER_LABELS: Record<VaultItemType, string> = { login: "Senhas", card: "Cartões", document: "Docs", secure_note: "Notas" }

export function ItemsTab({ items, adding, onAddingChange, onOpenReport, now, initialOpenId = null }: { items: VaultItem[]; adding: boolean; onAddingChange: (open: boolean) => void; onOpenReport: () => void; now: Date; initialOpenId?: string | null }) {
  const actions = useVaultActions()
  const wide = useMediaQuery("(min-width: 1024px)")
  const phone = useIsMobile()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | VaultItemType>("all")
  const [openId, setOpenId] = useState<string | null>(initialOpenId)
  const [detailOpen, setDetailOpen] = useState(initialOpenId !== null)
  const [editing, setEditing] = useState<VaultItem | null>(null)
  const [toDelete, setToDelete] = useState<VaultItem | null>(null)

  useRestoreFocus(Boolean(toDelete))
  useRestoreFocus(detailOpen && !wide)
  const health = vaultHealth(items)
  const q = query.trim().toLowerCase()
  // Search looks only at names and non-secret details, never at passwords, card numbers or note text.
  const visible = items
    .filter((i) => (filter === "all" || i.type === filter) && (!q || `${i.name} ${i.username ?? ""} ${i.url ?? ""} ${i.file?.name ?? ""}`.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  // On desktop the first item is selected on its own, and so is the first one left when the selected one is filtered out.
  const open = (wide ? (visible.find((i) => i.id === openId) ?? visible[0]) : items.find((i) => i.id === openId)) ?? null
  const counts = (type: "all" | VaultItemType) => (type === "all" ? items.length : items.filter((i) => i.type === type).length)

  const sheets = (
    <>
      <ItemSheet open={adding || Boolean(editing)} item={editing} defaultType={filter === "all" ? "login" : filter} onClose={() => (setEditing(null), onAddingChange(false))} onSaved={(saved) => setOpenId(saved.id)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete ? `Excluir “${toDelete.name}”?` : "Excluir este item?"}
        description="O item será apagado do cofre e dos backups futuros."
        onConfirm={() => {
          const item = toDelete
          setToDelete(null)
          if (!item) return
          actions.removeWithUndo(item)
          setOpenId(null)
          setDetailOpen(false)
        }}
      />
    </>
  )

  // ---------------------------------------------------------- an empty vault: only the invitation
  if (items.length === 0) {
    return (
      <div data-testid="vault-items" className="flex min-w-0 flex-col gap-4">
        <div data-testid="vault-empty" className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-[20px] border border-border px-6 py-14 text-center">
          <span aria-hidden className="flex size-14 items-center justify-center rounded-full border border-border">
            <ShieldCheckIcon strokeWidth={1.75} className="size-6" />
          </span>
          <p className="text-[20px] leading-7 font-semibold">Seu cofre está vazio</p>
          <p className="max-w-sm text-[14px] leading-5 text-muted-foreground">Guarde senhas, cartões, documentos e notas seguras. Tudo é criptografado aqui, no seu aparelho, e só você abre.</p>
          <Button type="button" data-testid="add-first" onClick={() => onAddingChange(true)} className="mt-1 h-12 rounded-full bg-highlight px-6 text-[15px] text-highlight-foreground hover:bg-highlight/90">
            Adicionar o primeiro item
          </Button>
        </div>
        {sheets}
      </div>
    )
  }

  const detail = open ? <ItemDetail key={open.id} item={open} unique={health.uniqueIds.includes(open.id)} now={now} mobile={!wide} onEdit={() => setEditing(open)} onDelete={() => setToDelete(open)} /> : null

  const list = (
    <section aria-label="Itens do Cofre" data-testid="vault-list" className="flex h-full min-h-0 min-w-0 flex-col gap-3 rounded-[20px] border border-border bg-card p-4">
      <div className="relative">
        <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={query} onChange={(e) => (touch(), setQuery(e.target.value))} placeholder="Buscar no cofre" aria-label="Buscar itens" autoComplete="off" data-testid="vault-search" className="h-11 w-full rounded-full border border-input bg-transparent pr-4 pl-10 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary" />
      </div>
      <PillTabs
        kind="tabs"
        ariaLabel="Filtrar por tipo"
        items={[{ id: "all", label: "Todos", count: counts("all") }, ...VAULT_TYPES.map((t) => ({ id: t, label: FILTER_LABELS[t], count: counts(t) }))]}
        value={filter}
        onSelect={(item) => setFilter(item.id as "all" | VaultItemType)}
        itemProps={(item) => ({ "data-filter": item.id })}
        className="-mx-1 shrink-0 px-1 [&_[data-pill]]:whitespace-nowrap"
      />
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.length === 0 ? (
          <p data-testid="vault-no-results" className="px-1 py-6 text-center text-[13px] leading-5 text-muted-foreground">
            Nada encontrado{q ? ` para “${query.trim()}”` : ""}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((item) => {
              const selected = wide && open?.id === item.id
              return (
                <li key={item.id}>
                  <ItemRow
                    item={item}
                    selected={selected}
                    onClick={() => {
                      setOpenId(item.id)
                      setDetailOpen(true)
                    }}
                  />
                </li>
              )
            })}
          </ul>
        )}
        <AddPill label="Adicionar item" onClick={() => onAddingChange(true)} className="shrink-0" />
      </div>
    </section>
  )

  return (
    <div data-testid="vault-items" className="flex min-w-0 flex-col gap-4">
      <VaultSummary health={health} mobile={phone} onReview={onOpenReport} />

      {wide ? (
        <div className="grid h-[min(680px,calc(100dvh-24rem))] min-h-[460px] grid-cols-12 gap-4">
          <div className="col-span-4 min-h-0 min-w-0">{list}</div>
          <section aria-label="Detalhe do item" className="col-span-8 flex min-h-0 min-w-0 flex-col rounded-[20px] border border-border bg-card p-6">
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
            <SheetContent side="bottom" showCloseButton={false} className="h-dvh max-h-dvh w-full gap-0 rounded-none p-0" data-testid="vault-detail-sheet">
              <SheetTitle className="sr-only">{open?.name ?? "Item"}</SheetTitle>
              <SheetDescription className="sr-only">Detalhes do item do Cofre.</SheetDescription>
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" aria-label="Voltar para a lista" data-testid="detail-back" onClick={() => setDetailOpen(false)} className="h-11 gap-2 rounded-full pr-4 pl-2">
                    <ArrowLeftIcon strokeWidth={1.75} /> <span className="text-[16px] font-semibold">Detalhes</span>
                  </Button>
                </div>
                {detail}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      {sheets}
    </div>
  )
}

