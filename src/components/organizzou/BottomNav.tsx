"use client"

import { PlusIcon, type LucideIcon } from "lucide-react"

import { GlassSurface } from "@/components/organizzou/GlassSurface"
import { useTextEntryFocused } from "@/hooks/use-text-entry-focused"
import { cn } from "@/lib/utils"

export type BottomNavItem = {
  id: string
  label: string
  icon: LucideIcon
}

type BottomNavProps = {
  /** Exactly 4 items; the "+" action sits in the middle, between the second and the third. */
  items: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem]
  /** Id of the current route's item, or "" when none of them is active. */
  activeId: string
  onSelect?: (id: string) => void
  onAdd?: () => void
  className?: string
}

const ease = "duration-[400ms] ease-organizzou motion-reduce:transition-none"

function NavButton({ item, active, onSelect }: { item: BottomNavItem; active: boolean; onSelect?: (id: string) => void }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect?.(item.id)}
      className={cn(
        "flex h-11 items-center justify-center rounded-full px-2.5 outline-none transition-[background-color,color]",
        ease,
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        // Only the active item may shrink (its label truncates), so the pill can never outgrow the screen.
        active ? "min-w-0 bg-highlight text-highlight-foreground" : "w-11 shrink-0 text-muted-foreground"
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-6 shrink-0" />
      <span
        aria-hidden
        className={cn(
          "min-w-0 truncate text-sm leading-5 font-medium transition-[max-width,padding,opacity]",
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
 * Mobile floating pill: permanent glass (GlassSurface), hairline border, no shadow. The active route expands into a Lima pill
 * with its label; the middle "+" is a regular Lima circle in the same row as the other items. It hides while a text field has
 * focus (the keyboard is open). Where it floats is up to the caller (className): use `inset-x-4 mx-auto w-fit max-w-full`
 * (not left-1/2 + translate), so the layout centers it and it can never be wider than the screen minus its gutters.
 */
export function BottomNav({ items, activeId, onSelect, onAdd, className }: BottomNavProps) {
  const [first, second, third, fourth] = items
  const typing = useTextEntryFocused()

  return (
    <GlassSurface
      as="nav"
      aria-label="Navegação principal"
      className={cn("flex h-14 items-center gap-0.5 px-1.5", typing && "hidden", className)}
    >
      <NavButton item={first} active={activeId === first.id} onSelect={onSelect} />
      <NavButton item={second} active={activeId === second.id} onSelect={onSelect} />
      <button
        type="button"
        aria-label="Criar novo"
        onClick={onAdd}
        className="mx-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground outline-none transition-transform duration-120 ease-organizzou focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 motion-reduce:transition-none"
      >
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-6" />
      </button>
      <NavButton item={third} active={activeId === third.id} onSelect={onSelect} />
      <NavButton item={fourth} active={activeId === fourth.id} onSelect={onSelect} />
    </GlassSurface>
  )
}
