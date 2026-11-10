"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * "‹ segunda, 9 de novembro ›": the one day navigator of the app. The arrows are fixed 44 × 44 buttons at the two edges and the title is
 * centered in the space between them (it goes to today when pressed). Full width, so on phones the title is centered on the screen.
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
  const title = "tabular min-w-0 flex-1 truncate rounded-full px-2 text-center text-[15px] leading-6 font-semibold whitespace-nowrap"
  return (
    <div data-testid={testId} className={cn("flex h-11 w-full items-center", className)}>
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
