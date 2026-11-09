"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, XIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatBR } from "@/features/studies/deadlines"
import { cn } from "@/lib/utils"

/** A date field: a 44 px button showing dd/MM/yyyy that opens the month picker. `value` is "yyyy-MM-dd". */
export function DatePickerField({ id, value, onChange, min, placeholder, onClear, className }: { id?: string; /** "yyyy-MM-dd", or "" for no date (then `placeholder` shows). */ value: string; onChange: (day: string) => void; /** Earliest selectable day ("yyyy-MM-dd"). */ min?: string; placeholder?: string; /** Shows a clear button while a date is set. */ onClear?: () => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(`${value}T12:00:00`) : undefined
  return (
    <div className="flex items-center gap-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} data-testid="date-field" aria-label={value ? `Data: ${formatBR(value)}` : (placeholder ?? "Escolher data")} className={cn("flex h-11 w-full items-center justify-between gap-2 rounded-[12px] border border-input bg-transparent px-3 text-left text-[15px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary", className)}>
          <span className={cn("tabular", !value && "text-muted-foreground")}>{value ? formatBR(value) : (placeholder ?? "Escolher data")}</span>
          <CalendarIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-72 p-2">
        <Calendar
          mode="single"
          locale={ptBR}
          defaultMonth={selected ?? (min ? new Date(`${min}T12:00:00`) : undefined)}
          selected={selected}
          disabled={min ? { before: new Date(`${min}T12:00:00`) } : undefined}
          onSelect={(date) => {
            if (!date) return
            onChange(format(date, "yyyy-MM-dd"))
            setOpen(false)
          }}
          className="mx-auto w-full [--cell-size:--spacing(9)]"
        />
      </PopoverContent>
    </Popover>
    {onClear && value ? (
      <button type="button" aria-label="Remover a data" onClick={onClear} className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-border outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
        <XIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
    ) : null}
    </div>
  )
}
