"use client"

import { useId } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

type HabitCheckProps = {
  label: string
  /** Supporting text, e.g. current streak. */
  support?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

export function HabitCheck({
  label,
  support,
  checked,
  onCheckedChange,
  className,
}: HabitCheckProps) {
  const id = useId()

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 py-2 select-none",
        className
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="data-checked:animate-in data-checked:zoom-in-90 data-checked:duration-200"
      />
      <span className="flex flex-col">
        <span
          className={cn(
            "text-[15px] leading-6 transition-colors",
            checked && "text-muted-foreground line-through"
          )}
        >
          {label}
        </span>
        {support ? (
          <span className="tabular text-[13px] leading-5 text-muted-foreground">{support}</span>
        ) : null}
      </span>
    </label>
  )
}
