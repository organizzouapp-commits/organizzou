"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

export type PillItem = { id: string; label: string; /** Shown inside the pill, after the label. */ count?: number }

/** The ONE pill look of Tarefas: filled neutral pill (no outline), 36px, 13px, 12px padding, Lima only when active, 44px hit area. */
export const pillClass = (active: boolean) =>
  cn(
    "relative inline-flex h-9 shrink-0 snap-center items-center justify-center gap-1.5 rounded-full px-3 text-[13px] leading-5 whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] select-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
    active ? "bg-highlight font-semibold text-highlight-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
  )

/** The dashed action pill at the end of a row ("+ Lista", "✎ Editar"). */
export const dashedPillClass = "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-[13px] leading-5 whitespace-nowrap text-muted-foreground outline-none after:absolute after:inset-x-0 after:-inset-y-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"

type PillTabsProps = {
  items: PillItem[]
  /** The active id (tabs), or null when several/none can be on (toggles use `isOn`). */
  value?: string | null
  isOn?: (item: PillItem) => boolean
  onSelect: (item: PillItem) => void
  ariaLabel: string
  /** "tabs": role=tablist/tab + aria-selected. "toggles": a group of aria-pressed buttons. */
  kind?: "tabs" | "toggles"
  /** Equal-width pills that fill the row (the mode switcher) instead of a scroller of natural widths. */
  equal?: boolean
  /** The dashed action pill(s) at the end. */
  trailing?: React.ReactNode
  /** Extra attributes per pill (data-*). */
  itemProps?: (item: PillItem) => React.HTMLAttributes<HTMLButtonElement> & Record<string, unknown>
  className?: string
  /** A thin visible scrollbar (.scroll-soft) instead of a hidden one, for rows that really scroll (Finanças categories). */
  soft?: boolean
}

/**
 * Kanban list tabs, Lista shortcut chips and the calendar mode switcher all render through this: same height, radius, fill, gap and
 * scrolling (a horizontal snap scroller that keeps the active pill in view).
 */
export function PillTabs({ items, value = null, isOn, onSelect, ariaLabel, kind = "tabs", equal = false, trailing, itemProps, className, soft = false }: PillTabsProps) {
  const row = useRef<HTMLDivElement>(null)
  const activeKey = items.map((i) => (isOn ? isOn(i) : i.id === value)).join()
  useEffect(() => {
    row.current?.querySelector<HTMLElement>("[data-pill-active=true]")?.scrollIntoView({ inline: "center", block: "nearest" })
  }, [activeKey])
  return (
    <div ref={row} role={kind === "tabs" ? "tablist" : "group"} aria-label={ariaLabel} data-pill-row className={cn("h-9 gap-2", equal ? "grid grid-cols-4" : cn("flex snap-x overflow-x-auto", soft ? "scroll-soft" : "no-scrollbar"), className)}>
      {items.map((item) => {
        const on = isOn ? isOn(item) : item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role={kind === "tabs" ? "tab" : undefined}
            aria-selected={kind === "tabs" ? on : undefined}
            aria-pressed={kind === "toggles" ? on : undefined}
            data-pill
            data-pill-active={on}
            onClick={() => onSelect(item)}
            {...itemProps?.(item)}
            className={cn(pillClass(on), equal && "min-w-0 px-1.5")}
          >
            <span className={cn(equal && "truncate")}>{item.label}</span>
            {item.count !== undefined ? <span className={cn("tabular", on ? "opacity-70" : "")}>{item.count}</span> : null}
          </button>
        )
      })}
      {trailing}
    </div>
  )
}
