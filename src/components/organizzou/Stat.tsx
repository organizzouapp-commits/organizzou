import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StatProps = {
  label: string
  value: string
  /** Supporting line under the number. */
  support?: string
  /** Financial trend: shown with an arrow and the sign, never with color alone. */
  trend?: "up" | "down"
  /** "sm" fits long values such as currency in narrow columns. */
  size?: "default" | "sm"
  className?: string
}

// Label + hero number + support text, no box (DESIGN-SYSTEM §8).
export function Stat({ label, value, support, trend, size = "default", className }: StatProps) {
  const TrendIcon = trend === "down" ? ArrowDownRightIcon : ArrowUpRightIcon

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "tabular flex items-center gap-1.5 font-semibold tracking-[-0.02em]",
          size === "sm" ? "text-2xl leading-8" : "text-[30px] leading-9 md:text-4xl md:leading-10"
        )}
      >
        {trend ? <TrendIcon aria-hidden strokeWidth={1.75} className={size === "sm" ? "size-5" : "size-6"} /> : null}
        {value}
      </span>
      {support ? (
        <span className="tabular text-[13px] leading-5 text-muted-foreground">{support}</span>
      ) : null}
    </div>
  )
}
