"use client"

import { forwardRef, useState } from "react"
import { ArrowUpDownIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Pill search, the same treatment as the header's search (radius 999, card background, border, 15px text, icon at 16px). */
export const SearchField = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; className?: string; onFocus?: () => void; onBlur?: () => void; onEscape?: () => void; hint?: boolean; label?: string }>(function SearchField(
  { value, onChange, className, onFocus, onBlur, onEscape, hint, label = "Buscar tarefas" },
  ref
) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            onEscape?.()
          }
        }}
        className="h-11 rounded-full border-border bg-card pr-10 pl-11 text-[15px] md:h-10 dark:bg-card"
      />
      {hint && !value ? <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-border px-1.5 text-[12px] leading-5 text-muted-foreground md:block">/</kbd> : null}
    </div>
  )
})

/** Desktop: a search circle that expands inline into the pill (Tarefas and Finanças toolbars). */
export const ExpandingSearch = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void; label: string; hint?: boolean }>(function ExpandingSearch({ value, onChange, label, hint }, ref) {
  const [open, setOpen] = useState(Boolean(value))
  return (
    <div className="flex items-center">
      <Button variant="outline" size="icon" className={cn("size-10 rounded-full", open && "hidden")} aria-label={label} onClick={() => setOpen(true)}>
        <SearchIcon strokeWidth={1.75} />
      </Button>
      <div className={cn("relative transition-[width] duration-[400ms] motion-reduce:transition-none", "ease-[cubic-bezier(0.2,0.8,0.2,1)]", open ? "w-56" : "w-0 overflow-hidden")}>
        <SearchField ref={ref} label={label} hint={hint} value={value} onChange={onChange} onFocus={() => setOpen(true)} onBlur={() => !value && setOpen(false)} onEscape={() => (onChange(""), setOpen(false))} className="w-56" />
      </div>
    </div>
  )
})

/** The "Ordem" select: arrow-up-down icon and the chosen label (the label hides below 1536px when `compactLabel`). */
export function ToolbarSort<T extends string>({ value, onChange, options, className }: { value: T; onChange: (value: T) => void; options: { id: T; label: string }[]; className?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger aria-label="Ordenar" className={cn("w-auto min-w-0 gap-2 rounded-full", className)}>
        <ArrowUpDownIcon aria-hidden strokeWidth={1.75} className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
