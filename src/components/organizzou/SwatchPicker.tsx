"use client"

import { CheckIcon } from "lucide-react"

import { SWATCH_IDS, getSwatch, type SwatchId } from "@/lib/swatches"
import { cn } from "@/lib/utils"

type SwatchPickerProps = {
  value: SwatchId
  onChange: (value: SwatchId) => void
  label?: string
  className?: string
}

/** The only "color picker" in the product: six fixed swatches built from the brand palette. */
export function SwatchPicker({ value, onChange, label = "Cor", className }: SwatchPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex min-h-11 flex-wrap items-center gap-2 md:min-h-9", className)}>
      {SWATCH_IDS.map((id) => {
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={getSwatch(id).label}
            title={getSwatch(id).label}
            onClick={() => onChange(id)}
            className="relative flex size-8 items-center justify-center rounded-full outline-none after:absolute after:-inset-1.5 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span aria-hidden className={cn("size-6 rounded-full", getSwatch(id).fill)} />
            {selected ? (
              <CheckIcon
                aria-hidden
                strokeWidth={2}
                className={cn(
                  "absolute size-3.5",
                  id === "grafite" || id === "tinta-verso" ? "text-palette-papel" : id === "neutro" ? "text-foreground" : "text-palette-tinta"
                )}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
