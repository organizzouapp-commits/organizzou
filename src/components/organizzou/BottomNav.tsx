"use client"

import { useEffect, useState } from "react"
import { PlusIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type BottomNavItem = {
  id: string
  label: string
  icon: LucideIcon
}

type BottomNavProps = {
  /** Exactly 4 items; the raised "+" action sits in the middle, between the second and the third. */
  items: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem]
  /** Id of the current route's item, or "" when none of them is active (actions like the assistant are never active). */
  activeId: string
  onSelect?: (id: string) => void
  onAdd?: () => void
  className?: string
}

const ease = "duration-[400ms] ease-organizzou motion-reduce:transition-none"

/** Inputs that bring up the on-screen keyboard (read-only fields, checkboxes and buttons do not). */
function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return !target.readOnly
  if (!(target instanceof HTMLInputElement) || target.readOnly) return false
  return !["checkbox", "radio", "button", "submit", "reset", "range", "file", "color", "image"].includes(target.type)
}

/** True while a text field has focus, i.e. while the keyboard covers the bottom of the screen. */
function useTextEntryFocused() {
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const onIn = (event: FocusEvent) => setFocused(isTextEntry(event.target))
    const onOut = () => setFocused(false)
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    return () => {
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
    }
  }, [])
  return focused
}

function NavButton({ item, active, onSelect }: { item: BottomNavItem; active: boolean; onSelect?: (id: string) => void }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect?.(item.id)}
      className={cn(
        "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-2.5 outline-none transition-[background-color,color]",
        ease,
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-highlight text-highlight-foreground" : "text-muted-foreground"
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-6 shrink-0" />
      <span
        aria-hidden
        className={cn(
          "overflow-hidden text-sm leading-5 font-medium whitespace-nowrap transition-[max-width,padding,opacity]",
          ease,
          active ? "max-w-24 pl-2 opacity-100" : "max-w-0 pl-0 opacity-0"
        )}
      >
        {item.label}
      </span>
    </button>
  )
}

/**
 * Mobile floating pill: a solid card surface with a hairline border, no blur and no shadow. The active route expands
 * into a Lima pill with its label; the middle "+" is a larger Lima button raised above the pill with a ring in the page
 * background, so it looks cut out of it. The pill hides while a text field has focus (the keyboard is open). Where it floats
 * is up to the caller (className), e.g. the app shell fixes it above the bottom safe area.
 */
export function BottomNav({ items, activeId, onSelect, onAdd, className }: BottomNavProps) {
  const [first, second, third, fourth] = items
  const typing = useTextEntryFocused()

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "relative flex h-14 w-fit items-center rounded-full border border-border bg-card px-2",
        typing && "hidden",
        className
      )}
    >
      <NavButton item={first} active={activeId === first.id} onSelect={onSelect} />
      <NavButton item={second} active={activeId === second.id} onSelect={onSelect} />
      <div aria-hidden className="w-16 shrink-0" />
      <button
        type="button"
        aria-label="Criar novo"
        onClick={onAdd}
        className="absolute top-0 left-1/2 flex size-14 -translate-x-1/2 -translate-y-3.5 items-center justify-center rounded-full bg-highlight text-highlight-foreground ring-4 ring-background outline-none transition-transform duration-120 ease-organizzou focus-visible:ring-ring/50 active:scale-95 motion-reduce:transition-none"
      >
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-7" />
      </button>
      <NavButton item={third} active={activeId === third.id} onSelect={onSelect} />
      <NavButton item={fourth} active={activeId === fourth.id} onSelect={onSelect} />
    </nav>
  )
}
