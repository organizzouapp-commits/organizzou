"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, CircleCheckIcon, EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ListRow } from "@/features/tasks/types"

import { InlineInput } from "./inline-input"

/** What the person can do to a list (a Kanban column or a Lista group). The same set everywhere. */
export type ListActions = {
  onRenameList: (list: ListRow, name: string) => Promise<void>
  onToggleDoneList: (list: ListRow) => void
  onMoveList: (list: ListRow, direction: -1 | 1) => void
  onDeleteList: (list: ListRow) => void
  onClearDone: (list: ListRow) => void
  onAddList: (name: string) => Promise<void>
  onReorderLists: (ids: string[]) => void
  /** Collapsed state, shared by Kanban and Lista (per quadro). */
  collapsed: (list: ListRow) => boolean
  onToggleCollapse: (list: ListRow) => void
}

const STORAGE = "organizzou:tarefas-lists:"

/**
 * Per quadro, per device: which lists are collapsed. Stored in localStorage (no schema change needed; a per-user preferences
 * column can replace it later). Lists never touched fall back to `fallback` (Lista folds "concluded" lists by default).
 */
export function useCollapsedLists(boardId: string, fallback: (list: ListRow) => boolean) {
  const [state, setState] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE + boardId)
      // localStorage only exists in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(raw ? (JSON.parse(raw) as Record<string, boolean>) : {})
    } catch {
      setState({})
    }
  }, [boardId])
  const collapsed = useCallback((list: ListRow) => state[list.id] ?? fallback(list), [state, fallback])
  const toggle = useCallback(
    (list: ListRow) => {
      setState((current) => {
        const next = { ...current, [list.id]: !(current[list.id] ?? fallback(list)) }
        try {
          window.localStorage.setItem(STORAGE + boardId, JSON.stringify(next))
        } catch {
          // Private mode: the choice just does not survive the visit.
        }
        return next
      })
    },
    [boardId, fallback]
  )
  return { collapsed, toggle }
}

const item = "min-h-11 gap-3 rounded-xl px-3 text-[15px]"

/** The ⋯ menu of a list header (Kanban and Lista). */
export function ListMenu({ list, index, total, count, actions, onRename }: { list: ListRow; index: number; total: number; count: number; actions: ListActions; onRename: () => void }) {
  const collapsed = actions.collapsed(list)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Opções da lista ${list.name}`} className="size-9 rounded-full max-md:size-11">
          <EllipsisIcon strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60 rounded-2xl p-2">
        <DropdownMenuItem className={item} onSelect={onRename}>
          <PencilIcon strokeWidth={1.75} /> Renomear
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => actions.onToggleCollapse(list)}>
          <ChevronDownIcon strokeWidth={1.75} /> {collapsed ? "Expandir" : "Recolher"}
        </DropdownMenuItem>
        <DropdownMenuItem className={item} disabled={index === 0} onSelect={() => actions.onMoveList(list, -1)}>
          <ArrowLeftIcon strokeWidth={1.75} /> Mover para a esquerda
        </DropdownMenuItem>
        <DropdownMenuItem className={item} disabled={index === total - 1} onSelect={() => actions.onMoveList(list, 1)}>
          <ArrowRightIcon strokeWidth={1.75} /> Mover para a direita
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => actions.onToggleDoneList(list)}>
          <CircleCheckIcon strokeWidth={1.75} /> {list.is_done_list ? "Não conta como concluída" : "Conta como concluída"}
        </DropdownMenuItem>
        {list.is_done_list ? (
          <DropdownMenuItem className={item} disabled={count === 0} onSelect={() => actions.onClearDone(list)}>
            <Trash2Icon strokeWidth={1.75} /> Limpar concluídas
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={item} onSelect={() => actions.onDeleteList(list)}>
          <Trash2Icon strokeWidth={1.75} /> Excluir lista
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The list name: a click renames it in place (auto-commit), Esc cancels. `controlledEditing` lets the menu's "Renomear" start it too. */
export function ListName({ list, actions, editing, onEditingChange, className }: { list: ListRow; actions: ListActions; editing: boolean; onEditingChange: (editing: boolean) => void; className?: string }) {
  if (editing) {
    return <InlineInput initialValue={list.name} ariaLabel={`Nome da lista ${list.name}`} className="min-w-0 flex-1" inputClassName="h-9 text-[15px] font-semibold" onCommit={(name) => actions.onRenameList(list, name)} onClose={() => onEditingChange(false)} />
  }
  return (
    <h3 className={cn("min-w-0 flex-1", className)}>
      <button type="button" onClick={() => onEditingChange(true)} title="Clique para renomear" className="max-w-full truncate rounded-md text-left text-[15px] leading-6 font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 max-md:min-h-11">
        {list.name}
      </button>
    </h3>
  )
}
