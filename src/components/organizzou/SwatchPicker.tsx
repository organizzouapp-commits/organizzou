"use client"

import { CheckIcon } from "lucide-react"

import { SWATCH_IDS, getSwatch, type SwatchId } from "@/lib/swatches"
import { cn } from "@/lib/utils"

type SwatchPickerProps = {
  value: SwatchId
  onChange: (value: SwatchId) => void
  label?: string
  /** 36 px swatches in one row (dialogs) instead of the compact 24 px ones. */
  large?: boolean
  className?: string
}

/** The only "color picker" in the product: six fixed swatches built from the brand palette. */
export function SwatchPicker({ value, onChange, label = "Cor", large = false, className }: SwatchPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex min-h-11 flex-wrap items-center", large ? "gap-1" : "gap-2 md:min-h-9", className)}>
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
            className={cn("relative flex items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50", large ? "size-11" : "size-8 after:absolute after:-inset-1.5")}
          >
            <span aria-hidden className={cn("rounded-full", large ? "size-9" : "size-6", getSwatch(id).fill)} />
            {selected ? (
              <CheckIcon
                aria-hidden
                strokeWidth={2}
                className={cn(
                  large ? "absolute size-4" : "absolute size-3.5",
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
