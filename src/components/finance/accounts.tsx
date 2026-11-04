"use client"

import { useState } from "react"
import { DndContext, closestCenter, type Announcements, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArchiveIcon, ArchiveRestoreIcon, GripVerticalIcon, PencilIcon, PlusIcon, TextCursorInputIcon, Trash2Icon } from "lucide-react"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { useTaskSensors } from "@/components/tasks/task-dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { orderAccounts } from "@/features/finance/account-meta"
import { accountBalance } from "@/features/finance/stats"
import type { AccountRow } from "@/features/finance/types"
import { cn } from "@/lib/utils"

import { useFinance } from "./context"
import { AccountGlyph } from "./dialogs"
import { MoneyText, RowMenu } from "./parts"

/** The ⋯ menu of an account (wallet card and manager row): Editar, Renomear, Arquivar / Reativar, Excluir. */
export function AccountMenu({ account, onRename, className }: { account: AccountRow; onRename?: () => void; className?: string }) {
  const f = useFinance()
  const archived = Boolean(f.accountMeta[account.id]?.archived)
  return (
    <RowMenu
      title={account.name}
      className={className}
      extra={[
        ...(onRename ? [{ label: "Renomear", icon: TextCursorInputIcon, onSelect: onRename }] : []),
        { label: archived ? "Reativar" : "Arquivar", icon: archived ? ArchiveRestoreIcon : ArchiveIcon, onSelect: () => f.setAccountArchived(account, !archived) },
      ]}
      onEdit={() => f.editAccount(account)}
      onDelete={() => f.askDeleteAccount(account)}
    />
  )
}

function ManagerRow({ account, renaming, onRename, onDoneRename }: { account: AccountRow; renaming: boolean; onRename: () => void; onDoneRename: () => void }) {
  const f = useFinance()
  const meta = f.accountMeta[account.id]
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: account.id })
  const [draft, setDraft] = useState(account.name)
  const commit = () => {
    f.renameAccount(account, draft)
    onDoneRename()
  }
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} data-manager-account={account.id} className={cn("flex items-center gap-2 rounded-[14px] border border-border bg-card p-2 pr-1", isDragging && "relative z-20 opacity-90", meta?.archived && "opacity-70")}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        data-grip
        aria-label={`Reordenar ${account.name}`}
        className="relative flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground outline-none after:absolute after:-inset-1.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
        <AccountGlyph account={account} meta={meta} className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {renaming ? (
          <Input
            autoFocus
            value={draft}
            maxLength={60}
            aria-label={`Novo nome de ${account.name}`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") {
                e.stopPropagation()
                onDoneRename()
              }
            }}
            className="h-9 rounded-[12px]"
          />
        ) : (
          <button type="button" data-account-name onClick={() => f.editAccount(account)} className="truncate text-left text-[15px] leading-6 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {account.name}
          </button>
        )}
        <span className="flex items-center gap-2 text-[13px] leading-5 text-muted-foreground">
          <MoneyText cents={accountBalance(account, f.transactions)} tone="value" />
          {meta?.archived ? <span className="inline-flex h-5 items-center rounded-full border border-foreground/25 px-2 text-[11px]">Arquivada</span> : null}
        </span>
      </div>
      <AccountMenu account={account} onRename={onRename} />
    </li>
  )
}

/** "Gerenciar": every account in a list you can reorder (grip, touch long press or keyboard), rename in place, edit, archive and delete. */
export function AccountManager({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const f = useFinance()
  const sensors = useTaskSensors()
  const [showArchived, setShowArchived] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const ordered = orderAccounts(f.allAccounts, f.accountOrder)
  const list = ordered.filter((a) => showArchived || !f.accountMeta[a.id]?.archived)
  const ids = list.map((a) => a.id)
  const archivedCount = f.allAccounts.filter((a) => f.accountMeta[a.id]?.archived).length
  const nameOf = (id: string | number) => list.find((a) => a.id === id)?.name ?? "Conta"
  const pos = (id: string | number) => ids.indexOf(String(id)) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Conta ${nameOf(active.id)} levantada. Posição ${pos(active.id)} de ${ids.length}.`,
    onDragOver: ({ active, over }) => (over ? `Conta ${nameOf(active.id)} sobre a posição ${pos(over.id)} de ${ids.length}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Conta ${nameOf(active.id)} solta na posição ${pos(over.id)} de ${ids.length}.` : `Conta ${nameOf(active.id)} solta onde estava.`),
    onDragCancel: ({ active }) => `Reordenação cancelada. A conta ${nameOf(active.id)} voltou ao lugar.`,
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    // The accounts that are not on show (archived, hidden) keep their place after the ones that moved.
    f.reorderAccounts([...moved, ...ordered.map((a) => a.id).filter((id) => !moved.includes(id))])
  }
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Gerenciar contas" description="Reordene, renomeie, edite, arquive ou exclua suas contas.">
      <div data-testid="account-manager" className="flex flex-col gap-3 pb-1">
        <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
          <span>
            Mostrar arquivadas <span className="tabular text-muted-foreground">({archivedCount})</span>
          </span>
          <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Mostrar arquivadas" />
        </label>
        <DndContext id="accounts-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: { draggable: "Para reordenar, aperte espaço, use as setas para mover e aperte espaço para soltar. Esc cancela." } }}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {list.map((a) => (
                <ManagerRow key={a.id} account={a} renaming={renaming === a.id} onRename={() => setRenaming(a.id)} onDoneRename={() => setRenaming(null)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {list.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhuma conta por aqui.</p> : null}
        <Button type="button" variant="outline" className="h-11 w-full border-dashed" onClick={f.openNewAccount}>
          <PlusIcon strokeWidth={1.75} /> Adicionar conta…
        </Button>
      </div>
    </ResponsiveSheet>
  )
}

type Choice = "archive" | "move" | "cascade"

/**
 * Deleting an account. With no lançamentos: a confirmation (and Desfazer afterwards). With lançamentos: archive (recommended), move them to
 * another account, or delete the account together with them (typing its name).
 */
export function DeleteAccountDialog({ row, onClose }: { row: AccountRow | null; onClose: () => void }) {
  const f = useFinance()
  const count = row ? f.accountTxCount(row.id) : 0
  if (!row) return null
  if (count === 0) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={`Excluir ${row.name}?`}
        description="A conta não tem lançamentos. Você poderá desfazer logo depois."
        confirmLabel="Excluir conta"
        onConfirm={() => {
          f.deleteAccount(row, { kind: "plain" })
          onClose()
        }}
      />
    )
  }
  return (
    <ResponsiveSheet open onOpenChange={(open) => !open && onClose()} title={`Excluir ${row.name}`} description={`Essa conta tem ${count} ${count === 1 ? "lançamento" : "lançamentos"}. O que fazer com ${count === 1 ? "ele" : "eles"}?`}>
      <DeleteChoices key={row.id} row={row} count={count} onClose={onClose} />
    </ResponsiveSheet>
  )
}

function DeleteChoices({ row, count, onClose }: { row: AccountRow; count: number; onClose: () => void }) {
  const f = useFinance()
  const others = f.accounts.filter((a) => a.id !== row.id)
  const [choice, setChoice] = useState<Choice>("archive")
  const [target, setTarget] = useState(others[0]?.id ?? "")
  const [typed, setTyped] = useState("")
  const options: { id: Choice; title: string; text: string; disabled?: boolean }[] = [
    { id: "archive", title: "Arquivar (recomendado)", text: "A conta some das listas e dos totais, e o histórico fica guardado." },
    { id: "move", title: "Mover os lançamentos para outra conta…", text: "Os lançamentos passam para a conta escolhida e esta é excluída.", disabled: others.length === 0 },
    { id: "cascade", title: "Excluir conta e lançamentos", text: `Apaga a conta e ${count} ${count === 1 ? "lançamento" : "lançamentos"}. É possível desfazer por alguns segundos.` },
  ]
  const ready = choice === "archive" || (choice === "move" && Boolean(target)) || (choice === "cascade" && typed.trim().toLowerCase() === row.name.trim().toLowerCase())
  const submit = () => {
    if (!ready) return
    if (choice === "archive") f.setAccountArchived(row, true)
    else if (choice === "move") f.deleteAccount(row, { kind: "move", to: target })
    else f.deleteAccount(row, { kind: "cascade" })
    onClose()
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div role="radiogroup" aria-label="O que fazer com os lançamentos" className="flex flex-col gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} disabled={o.disabled} onClick={() => setChoice(o.id)} className={cn("flex min-h-11 flex-col items-start gap-0.5 rounded-[14px] border p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50", choice === o.id ? "border-foreground/60 bg-foreground/5" : "border-border")}>
            <span className="text-[15px] leading-6 font-semibold">{o.title}</span>
            <span className="text-[13px] leading-5 text-muted-foreground">{o.text}</span>
          </button>
        ))}
      </div>
      {choice === "move" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="move-target">Mover para</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="move-target" className="w-full">
              <SelectValue placeholder="Escolha a conta" />
            </SelectTrigger>
            <SelectContent>
              {others.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {choice === "cascade" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-name">Para confirmar, digite o nome da conta: {row.name}</Label>
          <Input id="type-name" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className="h-11 rounded-[12px]" />
        </div>
      ) : null}
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-popover px-4 pt-3 pb-1 md:static md:mx-0 md:justify-end md:border-0 md:px-0 md:pt-1 md:pb-0">
        <Button type="button" variant="outline" className="h-11 flex-1 md:h-10 md:flex-none" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!ready} className="h-11 flex-1 md:h-10 md:flex-none">
          {choice === "archive" ? <ArchiveIcon strokeWidth={1.75} /> : choice === "cascade" ? <Trash2Icon strokeWidth={1.75} /> : <PencilIcon strokeWidth={1.75} />}
          {choice === "archive" ? "Arquivar conta" : choice === "move" ? "Mover e excluir" : "Excluir conta e lançamentos"}
        </Button>
      </div>
    </form>
  )
}
