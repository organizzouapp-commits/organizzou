"use client"

import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The flat collapsible group header of Agenda, Tarefas and Finanças: chevron, name, count pill. No surface of its own (the cards sit on
 * the page), 44 px tall. Pair it with <Collapse> for the rows.
 */
export function GroupHeader({ label, count, open, onToggle, className }: { label: string; count?: number; open: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" data-group-header aria-expanded={open} onClick={onToggle} className={cn("-ml-2 flex h-11 w-fit max-w-full items-center gap-2 rounded-full px-2 text-left text-[15px] font-semibold outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
      <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", !open && "-rotate-90")} />
      <span className="truncate">{label}</span>
      {count !== undefined ? <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[12px] leading-4 font-medium">{count}</span> : null}
    </button>
  )
}

/** The body of a group: height animates 0.4s, closed content is inert and invisible. */
export function Collapse({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div inert={!open} className={cn("grid transition-[grid-template-rows,visibility] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]", className)}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
