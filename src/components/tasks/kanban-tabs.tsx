"use client"

import { useEffect, useRef, useState } from "react"
import { PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ListRow } from "@/features/tasks/types"

import { InlineInput } from "./inline-input"

/** The id of the "Todas" tab (every list stacked, like Lista). */
export const ALL_TAB = "all"

/**
 * Phones, Kanban: the lists as a full-width 48px tab row. Equal widths while they fit, otherwise a snap scroller that keeps the
 * active tab in view; a trailing dashed "+ Lista" tab adds a list (auto-commit); a long press opens "Gerenciar listas".
 */
export function KanbanTabs({ lists, counts, allCount, activeId, onSelect, onAdd, onManage }: { lists: ListRow[]; counts: Record<string, number>; /** Pending tasks of the quadro (the "Todas" tab). */ allCount: number; activeId: string | undefined; onSelect: (id: string) => void; onAdd: (name: string) => Promise<void>; onManage: () => void }) {
  const [adding, setAdding] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  const press = useRef<number | undefined>(undefined)

  useEffect(() => {
    row.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ inline: "center", block: "nearest" })
  }, [activeId])
  useEffect(() => () => window.clearTimeout(press.current), [])

  return (
    <div ref={row} role="tablist" aria-label="Listas do quadro" className="no-scrollbar flex h-9 snap-x gap-1.5 overflow-x-auto" data-list-tabs>
      <button
        type="button"
        role="tab"
        aria-selected={activeId === ALL_TAB}
        data-all-tab
        onClick={() => onSelect(ALL_TAB)}
        className={cn(
          "relative flex h-9 shrink-0 snap-center items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] select-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
          activeId === ALL_TAB ? "bg-highlight font-semibold text-highlight-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        Todas
        <span className="tabular">{allCount}</span>
      </button>
      {lists.map((list) => {
        const active = list.id === activeId
        return (
          <button
            key={list.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-list-tab={list.id}
            onClick={() => onSelect(list.id)}
            onPointerDown={() => {
              window.clearTimeout(press.current)
              press.current = window.setTimeout(onManage, 600)
            }}
            onPointerUp={() => window.clearTimeout(press.current)}
            onPointerLeave={() => window.clearTimeout(press.current)}
            onPointerCancel={() => window.clearTimeout(press.current)}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "relative flex h-9 shrink-0 snap-center items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] select-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              "data-[drop-hover]:ring-2 data-[drop-hover]:ring-foreground/60", active ? "bg-highlight font-semibold text-highlight-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {list.name}
            <span className="tabular">{counts[list.id] ?? 0}</span>
          </button>
        )
      })}
      {adding ? (
        <div className="flex min-w-44 shrink-0 items-center rounded-full bg-card px-1">
          <InlineInput ariaLabel="Nome da nova lista" placeholder="Nome da lista" className="w-full items-center" inputClassName="h-8 rounded-full" onCommit={async (name) => void (await onAdd(name))} onClose={() => setAdding(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="relative flex h-9 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-[13px] whitespace-nowrap text-muted-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50">
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" /> Lista
        </button>
      )}
    </div>
  )
}
