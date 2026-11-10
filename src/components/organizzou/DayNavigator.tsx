"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * "‹ segunda, 9 de novembro ›": the one day navigator of the app, one responsive layout. It is a compact group (44 × 44 arrows right next to the title): centered on phones, at the start of its container from 768 px up. The title goes to today when pressed.
 */
export function DayNavigator({
  label,
  onPrev,
  onNext,
  onToday,
  nextDisabled,
  testId,
  labelTestId,
  className,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  /** Pressing the title; omit when the title is not a button. */
  onToday?: () => void
  nextDisabled?: boolean
  testId?: string
  labelTestId?: string
  className?: string
}) {
  const title = "tabular min-w-0 truncate rounded-full px-2 text-center text-[15px] leading-6 font-semibold whitespace-nowrap"
  return (
    <div data-testid={testId} className={cn("flex h-11 w-full items-center justify-center md:justify-start", className)}>
      <Button variant="ghost" aria-label="Dia anterior" className="size-11 shrink-0 rounded-full p-0 md:size-11" onClick={onPrev}>
        <ChevronLeftIcon strokeWidth={1.75} />
      </Button>
      {onToday ? (
        <button type="button" data-testid={labelTestId} aria-label="Ir para hoje" title="Ir para hoje" onClick={onToday} className={cn(title, "h-11 outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}>
          {label}
        </button>
      ) : (
        <span data-testid={labelTestId} className={title}>
          {label}
        </span>
      )}
      <Button variant="ghost" aria-label="Próximo dia" disabled={nextDisabled} className="size-11 shrink-0 rounded-full p-0 md:size-11" onClick={onNext}>
        <ChevronRightIcon strokeWidth={1.75} />
      </Button>
    </div>
  )
}
