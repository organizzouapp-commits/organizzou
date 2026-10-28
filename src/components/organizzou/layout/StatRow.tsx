import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Stat cards in an auto-fit grid: as many columns as fit (each at least `min` px wide), all cards in a row with the same
 * height. Put `KpiCard` / `Stat` cards inside; give at most one of them `tone="highlight"` (one Lima KPI per screen).
 */
export function StatRow({ children, min = 200, className }: { children: ReactNode; /** Minimum card width in px. */ min?: number; className?: string }) {
  return (
    <div
      className={cn("grid w-full min-w-0 auto-rows-fr gap-4 @min-[1040px]:gap-5", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }}
    >
      {children}
    </div>
  )
}
