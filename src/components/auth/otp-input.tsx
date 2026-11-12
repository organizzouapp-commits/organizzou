"use client"

import { useRef } from "react"

import { CODE_LENGTH, cleanCode } from "@/features/auth/two-factor"
import { cn } from "@/lib/utils"

/**
 * Six separate boxes for the e-mail code. The first one asks the browser for the one-time code (autofill from the SMS or e-mail app), a paste
 * of "123 456" fills all six, typing moves on, backspace moves back, and the arrow keys move between boxes.
 */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, idPrefix = "otp", autoFocus = true }: { value: string; onChange: (value: string) => void; onComplete?: (value: string) => void; disabled?: boolean; invalid?: boolean; idPrefix?: string; autoFocus?: boolean }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const digits = cleanCode(value).padEnd(CODE_LENGTH, " ").split("")

  const set = (next: string) => {
    const clean = cleanCode(next)
    onChange(clean)
    if (clean.length === CODE_LENGTH) onComplete?.(clean)
  }
  const focus = (index: number) => boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]?.focus()

  return (
    <div role="group" aria-label="Código de 6 dígitos" className="flex justify-between gap-2" data-testid="otp">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            boxes.current[index] = el
          }}
          id={`${idPrefix}-${index}`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          aria-label={`Dígito ${index + 1} de ${CODE_LENGTH}`}
          aria-invalid={invalid || undefined}
          value={digit.trim()}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, "")
            if (!typed) return
            // More than one digit in a box means an autofill or a paste: spread it from this box on.
            const base = cleanCode(value).slice(0, index)
            set(base + typed)
            focus(index + Math.max(1, typed.length))
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault()
              const current = cleanCode(value)
              if (current[index]) set(current.slice(0, index) + current.slice(index + 1))
              else {
                set(current.slice(0, Math.max(0, index - 1)) + current.slice(index))
                focus(index - 1)
              }
            } else if (event.key === "ArrowLeft") {
              event.preventDefault()
              focus(index - 1)
            }
            else if (event.key === "ArrowRight") {
              event.preventDefault()
              focus(index + 1)
            }
          }}
          onPaste={(event) => {
            event.preventDefault()
            set(event.clipboardData.getData("text"))
            focus(CODE_LENGTH - 1)
          }}
          className={cn("tabular size-12 min-w-0 flex-1 rounded-[12px] border border-input bg-transparent text-center text-[22px] font-semibold outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary aria-invalid:border-foreground md:size-14")}
        />
      ))}
    </div>
  )
}
