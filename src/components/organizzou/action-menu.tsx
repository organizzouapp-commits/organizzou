"use client"

import { useState } from "react"
import { EllipsisIcon, type LucideIcon } from "lucide-react"

import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type ActionItem = { label: string; icon: LucideIcon; run: () => void; /** A divider is drawn above this item. */ separated?: boolean }

const ROW = "flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[15px] leading-6 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"

/** The "…" button of a card: a popover on desktop and a bottom sheet with 44 px+ rows on phones. */
export function ActionMenu({ items, mobile, ariaLabel, title, className }: { items: ActionItem[]; mobile: boolean; ariaLabel: string; title: string; className?: string }) {
  const [sheet, setSheet] = useState(false)
  const trigger = (
    <Button type="button" variant="ghost" size="icon" aria-label={ariaLabel} onClick={mobile ? () => setSheet(true) : undefined} className={cn("size-11 shrink-0 rounded-full", className)}>
      <EllipsisIcon strokeWidth={1.75} />
    </Button>
  )
  if (mobile) {
    return (
      <>
        {trigger}
        <ResponsiveSheet open={sheet} onOpenChange={setSheet} title={title}>
          <div className="flex flex-col pb-2">
            {items.map(({ label, icon: Icon, run, separated }) => (
              <div key={label}>
                {separated ? <hr className="my-1 border-border" /> : null}
                <button
                  type="button"
                  className={ROW}
                  onClick={() => {
                    setSheet(false)
                    // Let the sheet close first, so whatever opens next (a field to focus, a dialog) is not fighting its focus trap.
                    window.setTimeout(run, 250)
                  }}
                >
                  <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" /> {label}
                </button>
              </div>
            ))}
          </div>
        </ResponsiveSheet>
      </>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {items.map(({ label, icon: Icon, run, separated }) => (
          <div key={label}>
            {separated ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem className="min-h-11 px-3 text-[14px]" onSelect={() => window.setTimeout(run, 150)}>
              <Icon strokeWidth={1.75} /> {label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
