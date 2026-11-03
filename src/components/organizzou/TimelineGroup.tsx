"use client"

import { ChevronDownIcon, type LucideIcon } from "lucide-react"

import { cardHover } from "@/components/organizzou/Bento"
import type { GroupId } from "@/features/today/prefs"
import { cn } from "@/lib/utils"
import { clock } from "@/components/organizzou/today/day-format"

const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"

/** A group of the day: the whole left side of the header toggles it; ONE count (a pill); folded, nothing else (no item titles). */
export function TimelineGroup({
  id,
  label,
  count,
  open,
  onToggle,
  icon: Icon,
  action,
  children,
}: {
  id: GroupId
  label: string
  count: string | number
  open: boolean
  onToggle: () => void
  icon?: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-label={label} data-group={id} className="flex flex-col">
      <div className="flex min-h-11 items-center gap-2">
        <button type="button" aria-expanded={open} onClick={onToggle} className={cn("-ml-2 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left", cardHover)}>
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", EASE, !open && "-rotate-90")} />
          {Icon ? <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" /> : null}
          <h3 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</h3>
          <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[12px] leading-4 font-medium">{count}</span>
        </button>
        {action}
      </div>
      {open ? children : null}
    </section>
  )
}

/** "agora": the current time in a Lima pill and a hairline across the card (Lima in dark, Tinta verso in light: `chart-1`). */
export function NowDivider({ nowMs }: { nowMs: number }) {
  return (
    <div role="separator" aria-label={`Agora, ${clock(nowMs)}`} data-now className="flex items-center gap-3 py-2">
      <span className="tabular inline-flex h-6 shrink-0 items-center rounded-full bg-highlight px-2.5 text-[12px] leading-4 font-semibold text-highlight-foreground">{clock(nowMs)}</span>
      <span aria-hidden className="h-px flex-1 bg-chart-1" />
    </div>
  )
}
