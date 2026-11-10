"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The dashed pill that is also the field ("Novo baralho…", "Nova prova ou prazo…"): type a short text and press Enter, or tap the plus to
 * open the form empty. The same look as AddPill, with a 2 px focus ring.
 */
export function QuickAdd({ label, shortLabel, ariaLabel, isMobile, onSubmit, inputId, className }: { /** An id for the text field, so a menu can focus it. */ inputId?: string; label: string; shortLabel: string; ariaLabel: string; isMobile: boolean; /** The typed text, trimmed; empty when the plus was tapped. */ onSubmit: (text: string) => void; className?: string }) {
  const [text, setText] = useState("")
  return (
    <form
      data-testid="quick-add"
      className={cn("flex h-11 w-full items-center gap-2 rounded-full border border-dashed border-border pr-4 pl-1 text-[14px] transition-colors duration-[400ms] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary motion-reduce:transition-none md:h-10", className)}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(text.trim())
        setText("")
      }}
    >
      <button type="submit" aria-label="Abrir o formulário completo" className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
      <input id={inputId} aria-label={ariaLabel} value={text} maxLength={120} onChange={(e) => setText(e.target.value)} placeholder={isMobile ? shortLabel : label} className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
    </form>
  )
}
