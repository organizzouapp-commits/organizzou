import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type PageShellProps = {
  /** Primary actions of the screen ("Nova tarefa", filters...). Right-aligned on wide screens, wraps below the heading on phones. */
  actions?: ReactNode
  /**
   * Only for screens that are NOT already titled by the app shell (the shell shows the page title and subtitle from
   * `src/components/shell/nav.ts`). When set, a heading block is rendered above the actions row.
   */
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}

/**
 * Consistent vertical rhythm for a dashboard screen: an optional heading, an actions row, then the content with a 24 px gap.
 * The shell already provides the page padding and the scroll container, so this adds no outer padding.
 */
export function PageShell({ actions, title, subtitle, children, className }: PageShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-6", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          {title ? (
            <div className="flex min-w-0 flex-col">
              <h2 className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">{title}</h2>
              {subtitle ? <p className="max-w-[72ch] text-[15px] leading-6 text-muted-foreground">{subtitle}</p> : null}
            </div>
          ) : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
