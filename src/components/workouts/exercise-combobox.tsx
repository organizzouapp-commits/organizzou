"use client"

import { useId, useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { exactExercise, exerciseOptions, type NamedExercise } from "@/features/workouts/exercise-search"
import { cn } from "@/lib/utils"

/** What the person chose: an exercise of the catalog, or a new name to create. */
export type ExerciseChoice = { kind: "existing"; id: string } | { kind: "create"; name: string }

/**
 * Type the exercise name freely. Suggestions from the catalog appear as the text grows (accent-insensitive, prefix then contains); when no
 * name matches exactly, the first option is 'Criar "texto"'. Arrow keys and Enter work, Esc closes the list. `onChange` fires on every
 * keystroke with the typed text and what it currently resolves to, so a form can submit without clicking an option.
 */
export function ExerciseCombobox({ catalog, text, onText, onChoice, id, autoFocus }: { catalog: NamedExercise[]; text: string; onText: (text: string) => void; onChoice: (choice: ExerciseChoice | null) => void; id?: string; autoFocus?: boolean }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const options = useMemo(() => exerciseOptions(catalog, text), [catalog, text])

  const resolve = (value: string): ExerciseChoice | null => {
    const exact = exactExercise(catalog, value)
    if (exact) return { kind: "existing", id: exact.id }
    return value.trim() ? { kind: "create", name: value.trim().replace(/\s+/g, " ") } : null
  }
  const pick = (index: number) => {
    const option = options[index]
    if (!option) return
    if (option.kind === "existing") {
      onText(option.name)
      onChoice({ kind: "existing", id: option.id })
    } else {
      onText(option.name)
      onChoice({ kind: "create", name: option.name })
    }
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Digite o nome do exercício"
        value={text}
        maxLength={120}
        onChange={(event) => {
          onText(event.target.value)
          onChoice(resolve(event.target.value))
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(options.length - 1, a + 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (event.key === "Enter" && open && options[active]) {
            event.preventDefault()
            pick(active)
          } else if (event.key === "Escape" && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
        className="h-11 w-full rounded-[12px]"
      />
      {open && options.length > 0 ? (
        <ul id={listId} role="listbox" aria-label="Exercícios" data-testid="exercise-options" className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-[12px] border border-border bg-popover p-1 text-popover-foreground">
          {options.map((option, index) => (
            <li
              key={option.kind === "create" ? "create" : option.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              data-option={option.kind}
              onMouseDown={(event) => {
                // Before the input loses focus, so the click is not eaten by the blur.
                event.preventDefault()
                pick(index)
              }}
              onMouseEnter={() => setActive(index)}
              className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] px-3 text-[15px] leading-5", index === active && "bg-accent")}
            >
              {option.kind === "create" ? (
                <>
                  <PlusIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" /> Criar “{option.name}”
                </>
              ) : (
                option.name
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
