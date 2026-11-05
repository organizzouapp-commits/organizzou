"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type ViewTab<T extends string> = { id: T; label: string; icon: LucideIcon }

/**
 * The segmented container of the page header card (Kanban | Lista | Agenda in Tarefas, Geral | Lançamentos | Fixas | Metas in Finanças): a
 * neutral track, the ACTIVE segment foreground 14% with weight 600, never Lima. On phones it is a full-width row with icon + label; with
 * `weighted` the inactive segments of a narrow phone (under 420px) keep only their icon and the active one takes the room of its label.
 */
export function ViewTabs<T extends string>({ tabs, value, onChange, ariaLabel, isMobile, columns = 3, weighted = false, dataAttr = "data-view-tab" }: { tabs: ViewTab<T>[]; value: T; onChange: (id: T) => void; ariaLabel: string; isMobile: boolean; columns?: 3 | 4; weighted?: boolean; dataAttr?: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("min-w-0 items-center gap-0.5 rounded-full bg-muted p-1 md:flex md:h-10", weighted ? "flex" : columns === 4 ? "grid grid-cols-4" : "grid grid-cols-3", isMobile ? "h-10 w-full gap-0 p-0" : "")}>
      {tabs.map(({ id, label, icon: Icon }) => {
        const on = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={label}
            title={label}
            {...{ [dataAttr]: id }}
            onClick={() => onChange(id)}
            className={cn(
              "flex h-full min-w-0 items-center justify-center gap-1.5 rounded-full px-1 text-[14px] whitespace-nowrap outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:px-3 min-[1536px]:px-4",
              weighted && (on ? "flex-[2]" : "flex-1"),
              on ? "bg-foreground/14 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon aria-hidden strokeWidth={1.75} className={isMobile ? "size-[18px] shrink-0" : "size-4"} />
            {isMobile ? <span className={cn("min-w-0 truncate text-[13px] leading-5 font-semibold", weighted && !on && "max-[419px]:sr-only")}>{label}</span> : <span className="max-[1535px]:sr-only">{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
