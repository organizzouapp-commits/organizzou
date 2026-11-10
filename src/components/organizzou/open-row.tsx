"use client"

import { PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The dashed row that opens a creation dialog ("Nova prova ou prazo…", "Novo baralho…"): the whole row is one button, so a click, Enter or
 * Space opens the dialog at once. The plus is only a visual cue. Same look as AddPill and QuickAdd.
 */
export function OpenRow({ label, shortLabel, isMobile, onOpen, className }: { label: string; shortLabel: string; isMobile: boolean; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-testid="open-row"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={cn("flex h-11 w-full items-center gap-2 rounded-full border border-dashed border-border pr-4 pl-1 text-left text-[14px] text-muted-foreground outline-none transition-colors duration-[400ms] hover:text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none md:h-10", className)}
    >
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center">
        <PlusIcon strokeWidth={1.75} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{isMobile ? shortLabel : label}</span>
    </button>
  )
}
