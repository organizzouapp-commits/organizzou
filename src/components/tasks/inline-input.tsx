"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type InlineInputProps = {
  initialValue?: string
  placeholder?: string
  ariaLabel: string
  /** Enter saves and the composer stays open for the next entry (task and checklist composers). */
  keepOpen?: boolean
  maxLength?: number
  /** A textarea that grows with its text (task titles); Shift+Enter inserts a line. */
  multiline?: boolean
  /** Return false when the save failed: the field stays open with the text. */
  onCommit: (value: string) => Promise<boolean | void> | boolean | void
  onClose: () => void
  /** Pasting several lines hands them over instead of putting them in the field. */
  onPasteLines?: (lines: string[]) => void
  className?: string
  inputClassName?: string
}

/**
 * The one inline add/rename field of the Tarefas screens. Auto-commit rule: leaving the field (tap outside, keyboard dismissed)
 * saves a non-empty trimmed text; empty text just closes; Enter saves (and stays open with `keepOpen`); Esc discards. Blur caused
 * by pressing the field's own buttons is ignored, and a save can only run once (Enter and blur never double submit).
 */
export function InlineInput({
  initialValue = "",
  placeholder,
  ariaLabel,
  keepOpen = false,
  maxLength = 80,
  multiline = false,
  onCommit,
  onClose,
  onPasteLines,
  className,
  inputClassName,
}: InlineInputProps) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const settled = useRef(false)
  const wrap = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = field.current
    if (!el) return
    el.focus()
    if (initialValue) el.select()
    // Focus once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function commit(stay: boolean) {
    if (running.current || settled.current) return
    const text = value.trim()
    if (!text || text === initialValue.trim()) {
      if (!stay) {
        settled.current = true
        onClose()
      }
      return
    }
    running.current = true
    setBusy(true)
    let ok: boolean | void = true
    try {
      ok = await onCommit(text.slice(0, maxLength))
    } finally {
      running.current = false
      setBusy(false)
    }
    if (ok === false) {
      field.current?.focus()
      return
    }
    if (stay) {
      setValue("")
      requestAnimationFrame(() => field.current?.focus())
    } else {
      settled.current = true
      onClose()
    }
  }

  function cancel() {
    settled.current = true
    onClose()
  }

  const shared = {
    ref: field,
    value,
    readOnly: busy,
    maxLength,
    placeholder,
    "aria-label": ariaLabel,
    enterKeyHint: keepOpen ? ("next" as const) : ("done" as const),
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setValue(e.target.value),
    onBlur: (e: React.FocusEvent) => {
      if (wrap.current?.contains(e.relatedTarget as Node | null)) return
      void commit(false)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      // Typing here must never reach a drag handle or a shortcut listener above (Space would start a drag).
      e.stopPropagation()
      if (e.key === "Enter" && !(multiline && e.shiftKey) && !e.nativeEvent.isComposing) {
        e.preventDefault()
        void commit(keepOpen)
      } else if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        cancel()
      }
    },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  }

  return (
    <div ref={wrap} className={cn("flex items-start gap-2", className)}>
      {multiline ? (
        <Textarea
          {...shared}
          rows={1}
          onPaste={(e) => {
            if (!onPasteLines) return
            const lines = e.clipboardData
              .getData("text")
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
            if (lines.length > 1) {
              e.preventDefault()
              onPasteLines(lines)
            }
          }}
          className={cn("min-h-11 min-w-0 flex-1 resize-none py-2.5", inputClassName)}
        />
      ) : (
        <Input {...shared} className={cn("h-11 min-w-0 flex-1 rounded-xl", inputClassName)} />
      )}
      <Button
        type="button"
        size="icon"
        aria-label="Salvar"
        className="size-11 shrink-0 rounded-full md:hidden"
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void commit(keepOpen)}
      >
        <CheckIcon strokeWidth={1.75} />
      </Button>
    </div>
  )
}
