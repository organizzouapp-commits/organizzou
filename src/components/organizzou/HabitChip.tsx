"use client"

import { CheckIcon, MinusIcon, PlusIcon } from "lucide-react"

import { cardHover } from "@/components/organizzou/Bento"
import { Button } from "@/components/ui/button"
import type { DayItem } from "@/features/today/types"
import { cn } from "@/lib/utils"
import { number, stepLabel } from "@/components/organizzou/today/day-format"

export type HabitActions = { toggle: (item: DayItem) => void; add: (item: DayItem) => void; remove: (item: DayItem) => void; qtyOf: (item: DayItem) => number; isDone: (item: DayItem) => boolean }

/** Habits are chips, not rows: a circle that fills when done, and for quantity habits an inline − / + (phones: only +). */
export function HabitChips({ habits, actions }: { habits: DayItem[]; actions: HabitActions }) {
  const circle = (done: boolean) => (
    <span aria-hidden className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full transition-colors duration-[400ms] motion-reduce:transition-none", done ? "bg-primary text-primary-foreground" : "border-[1.75px] border-muted-foreground/60")}>
      {done ? <CheckIcon strokeWidth={2.25} className="size-3.5" /> : null}
    </span>
  )
  const chip = (done: boolean) => cn("flex min-h-11 items-center gap-2 rounded-full border px-3 text-[15px] leading-5", done ? "border-transparent bg-foreground/6" : "border-border")
  return (
    <ul className="flex flex-wrap gap-2 pb-2">
      {habits.map((item) => {
        const done = actions.isDone(item)
        if (!item.habit) {
          return (
            <li key={item.id}>
              <button type="button" aria-pressed={done} onClick={() => actions.toggle(item)} className={cn(chip(done), "outline-none focus-visible:ring-3 focus-visible:ring-ring/50", cardHover)}>
                {circle(done)}
                <span className="font-medium">{item.title}</span>
              </button>
            </li>
          )
        }
        const qty = actions.qtyOf(item)
        const label = stepLabel(item.habit.unit, item.habit.target)
        const round = "size-9 shrink-0 rounded-full"
        return (
          <li key={item.id} className={cn(chip(done), "max-md:w-full")} data-habit-qty={item.id}>
            {circle(done)}
            <span className="min-w-0 font-medium">{item.title}</span>
            <span className="tabular ml-auto text-[13px] whitespace-nowrap text-muted-foreground md:ml-0">
              {number(qty)} de {number(item.habit.target)} {item.habit.unit}
            </span>
            <span className="-mr-1.5 flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" className={cn(round, "hidden md:inline-flex")} aria-label={`Remover ${label}`} disabled={qty <= 0} onClick={() => actions.remove(item)}>
                <MinusIcon strokeWidth={1.75} className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className={cn(round, "size-11 md:size-9")} aria-label={`Adicionar ${label}`} disabled={done} onClick={() => actions.add(item)}>
                <PlusIcon strokeWidth={1.75} className="size-4" />
              </Button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
