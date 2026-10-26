import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type ListRowProps = {
  icon?: LucideIcon
  title: string
  description?: string
  /** Right-aligned content: value, badge, chevron… */
  trailing?: ReactNode
  className?: string
}

// Lists come before cards: rows are separated by a hairline, no box (DESIGN-SYSTEM §5).
export function ListRow({ icon: Icon, title, description, trailing, className }: ListRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0",
        className
      )}
    >
      {Icon ? (
        <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-6">{title}</span>
        {description ? (
          <span className="truncate text-[13px] leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      {trailing ? <div className="tabular shrink-0 text-[15px]">{trailing}</div> : null}
    </div>
  )
}
