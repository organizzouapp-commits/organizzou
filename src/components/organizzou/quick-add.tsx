"use client"

import { useId, useRef, useState } from "react"
import { PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The dashed pill that is also the field ("Novo baralho…", "Nova prova ou prazo…"): type a short text and press Enter, or tap the plus.
 * The same look as AddPill, with a 2 px focus ring. Clicking or typing in the field never opens anything.
 *
 * By default the plus with nothing typed hands "" to `onSubmit` (callers open their full form). With `requireText` it instead focuses the
 * field and shows that hint under it, so only a typed name creates something.
 */
export function QuickAdd({
  label,
  shortLabel,
  ariaLabel,
  isMobile,
  onSubmit,
  inputId,
  requireText,
  className,
}: {
  /** An id for the text field, so a menu can focus it. */
  inputId?: string
  label: string
  shortLabel: string
  ariaLabel: string
  isMobile: boolean
  /** The typed text, trimmed (empty when the plus was tapped and `requireText` is not set). */
  onSubmit: (text: string) => void
  /** The inline hint shown when the plus is tapped with nothing typed; setting it also stops the empty submit from reaching `onSubmit`. */
  requireText?: string
  className?: string
}) {
  const [text, setText] = useState("")
  const [hint, setHint] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const hintId = useId()
  return (
    <div className="flex w-full flex-col gap-1.5">
      <form
        data-testid="quick-add"
        className={cn("flex h-11 w-full items-center gap-2 rounded-full border border-dashed border-border pr-4 pl-1 text-[14px] transition-colors duration-[400ms] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary motion-reduce:transition-none md:h-10", className)}
        onSubmit={(e) => {
          e.preventDefault()
          const typed = text.trim()
          if (requireText && typed === "") {
            setHint(true)
            field.current?.focus()
            return
          }
          setHint(false)
          onSubmit(typed)
          setText("")
        }}
      >
        <button type="submit" aria-label={requireText ? "Criar" : "Abrir o formulário completo"} className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" />
        </button>
        <input
          ref={field}
          id={inputId}
          aria-label={ariaLabel}
          aria-describedby={hint ? hintId : undefined}
          value={text}
          maxLength={120}
          onChange={(e) => {
            setText(e.target.value)
            if (hint) setHint(false)
          }}
          placeholder={isMobile ? shortLabel : label}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </form>
      {hint && requireText ? (
        <p id={hintId} role="status" data-testid="quick-add-hint" className="px-4 text-[13px] leading-5 text-muted-foreground">
          {requireText}
        </p>
      ) : null}
    </div>
  )
}
