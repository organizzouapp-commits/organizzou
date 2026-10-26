import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  /** Usually a single primary Button. */
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-6 py-12 text-center", className)}>
      <Icon aria-hidden strokeWidth={1.75} className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] leading-6 font-semibold">{title}</h3>
        {description ? (
          <p className="max-w-xs text-[15px] leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
