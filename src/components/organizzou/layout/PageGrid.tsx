import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * 12-column fluid grid. It reacts to the width it is given (container queries), not to the viewport, so it behaves the same
 * next to the expanded sidebar, the collapsed rail and on phones.
 *
 * Children choose their span with `PageGrid.Item` or with the classes below:
 *   col-span-12                          full width on every size
 *   col-span-12 @min-[640px]:col-span-6  halves from 640 px of container width
 *   col-span-12 @min-[1040px]:col-span-4 thirds from 1040 px
 */
export function PageGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("@container grid w-full min-w-0 grid-cols-12 gap-4 @min-[1040px]:gap-5", className)}>{children}</div>
}

const SPANS = {
  full: "col-span-12",
  half: "col-span-12 @min-[640px]:col-span-6",
  third: "col-span-12 @min-[640px]:col-span-6 @min-[1040px]:col-span-4",
  quarter: "col-span-6 @min-[1040px]:col-span-3",
  "two-thirds": "col-span-12 @min-[1040px]:col-span-8",
  "three-fifths": "col-span-12 @min-[900px]:col-span-7",
  "two-fifths": "col-span-12 @min-[900px]:col-span-5",
} as const

export type PageGridSpan = keyof typeof SPANS

PageGrid.Item = function PageGridItem({ span = "full", children, className }: { span?: PageGridSpan; children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0", SPANS[span], className)}>{children}</div>
}
