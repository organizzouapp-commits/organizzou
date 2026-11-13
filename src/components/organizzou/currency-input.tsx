"use client"

import { useRef } from "react"

import { Input } from "@/components/ui/input"
import { formatMasked, nextCentsFromTyping, nextSignedCentsFromTyping, parsePastedMoney } from "@/lib/currency-mask"
import { cn } from "@/lib/utils"

type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  /** Integer cents, or null for an empty field. */
  value: number | null
  onValueChange: (cents: number | null) => void
  /** The field may hold a negative amount (typing a "-" turns it negative). Off by default. */
  allowNegative?: boolean
}

/**
 * The one money field of the app: "R$" prefix, thousands dots and a decimal comma, filled by cents (typing 1234567 shows 12.345,67).
 * The numeric keyboard opens on phones, the text is selected on focus (so typing replaces it), paste understands "1.234,56" and "1234.56",
 * and the form receives integer cents.
 */
export function CurrencyInput({ value, onValueChange, allowNegative = false, className, placeholder = "0,00", ...rest }: CurrencyInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const text = value === null ? "" : formatMasked(value)
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted-foreground">
        R$
      </span>
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(event) => onValueChange((allowNegative ? nextSignedCentsFromTyping : nextCentsFromTyping)(text, event.target.value))}
        onFocus={(event) => {
          rest.onFocus?.(event)
          const el = event.currentTarget
          // After the focus settles, so a tap does not drop the selection again.
          requestAnimationFrame(() => el.select())
        }}
        onPaste={(event) => {
          const pasted = parsePastedMoney(event.clipboardData.getData("text"))
          event.preventDefault()
          if (pasted !== null) onValueChange(pasted)
          rest.onPaste?.(event)
        }}
        className={cn("tabular pl-10", className)}
      />
    </div>
  )
}
