"use client"

import { useEffect, useRef, useState } from "react"
import { PlusIcon } from "lucide-react"

import type { ListRow } from "@/features/tasks/types"

import { InlineInput } from "./inline-input"
import { dashedPillClass, PillTabs } from "./pill-tabs"

/** The id of the "Todas" tab (every list stacked, like Lista). */
export const ALL_TAB = "all"

/**
 * Phones, Kanban: the lists as pills (the shared PillTabs): Todas N first, then each list with its count, then a dashed "+ Lista" that
 * adds a list (auto-commit). A long press on a list tab opens "Gerenciar listas"; while dragging a card, hovering a tab switches list.
 */
export function KanbanTabs({ lists, counts, allCount, activeId, onSelect, onAdd, onManage }: { lists: ListRow[]; counts: Record<string, number>; /** Pending tasks of the quadro (the "Todas" tab). */ allCount: number; activeId: string | undefined; onSelect: (id: string) => void; onAdd: (name: string) => Promise<void>; onManage: () => void }) {
  const [adding, setAdding] = useState(false)
  const press = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(press.current), [])
  const clear = () => window.clearTimeout(press.current)

  return (
    <PillTabs
      ariaLabel="Listas do quadro"
      value={activeId}
      onSelect={(item) => onSelect(item.id)}
      items={[{ id: ALL_TAB, label: "Todas", count: allCount }, ...lists.map((l) => ({ id: l.id, label: l.name, count: counts[l.id] ?? 0 }))]}
      itemProps={(item) =>
        item.id === ALL_TAB
          ? { "data-all-tab": true }
          : {
              "data-list-tab": item.id,
              onPointerDown: () => {
                clear()
                press.current = window.setTimeout(onManage, 600)
              },
              onPointerUp: clear,
              onPointerLeave: clear,
              onPointerCancel: clear,
              onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
            }
      }
      trailing={
        adding ? (
          <div className="flex min-w-44 shrink-0 items-center rounded-full bg-card px-1">
            <InlineInput ariaLabel="Nome da nova lista" placeholder="Nome da lista" className="w-full items-center" inputClassName="h-8 rounded-full" onCommit={async (name) => void (await onAdd(name))} onClose={() => setAdding(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={dashedPillClass}>
            <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Lista
          </button>
        )
      }
      className="[&_[data-list-tab][data-drop-hover]]:ring-2 [&_[data-list-tab][data-drop-hover]]:ring-foreground/60"
    />
  )
}
