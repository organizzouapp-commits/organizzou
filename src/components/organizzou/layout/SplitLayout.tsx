import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type SplitLayoutProps = {
  /** The main column: lists, tables, the thing the screen is about. */
  children: ReactNode
  /** A contextual side column (summary, filters, next steps). Stacks below the main column under 1280 px. */
  aside: ReactNode
  /** Put the aside before the main content when stacked (e.g. filters on top). Default: after. */
  asideFirst?: boolean
  className?: string
}

/**
 * Main + aside from 1280 px of container width (aside is 320-380 px, sticky inside the scroll area), stacked below.
 * Both columns use the full height available; neither leaves a blank area.
 */
export function SplitLayout({ children, aside, asideFirst = false, className }: SplitLayoutProps) {
  return (
    <div className={cn("@container w-full min-w-0", className)}>
      <div className="grid min-w-0 grid-cols-1 gap-5 @min-[1000px]:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] @min-[1000px]:items-start">
        <div className={cn("min-w-0", asideFirst && "order-2 @min-[1000px]:order-1")}>{children}</div>
        <aside className={cn("flex min-w-0 flex-col gap-4 @min-[1000px]:sticky @min-[1000px]:top-0", asideFirst && "order-1 @min-[1000px]:order-2")}>{aside}</aside>
      </div>
    </div>
  )
}
