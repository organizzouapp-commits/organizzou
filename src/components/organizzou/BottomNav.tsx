"use client"

import type { LucideIcon } from "lucide-react"

import { GlassSurface } from "@/components/organizzou/GlassSurface"
import { cn } from "@/lib/utils"

export type BottomNavItem = {
  id: string
  label: string
  icon: LucideIcon
}

type BottomNavProps = {
  items: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem]
  /** Id of the current route's item, or "" when none of them is active. */
  activeId: string
  onSelect?: (id: string) => void
  className?: string
}

const ease = "duration-[400ms] ease-organizzou motion-reduce:transition-none"

function NavButton({ entry, active, onSelect }: { entry: BottomNavItem; active: boolean; onSelect?: (id: string) => void }) {
  const Icon = entry.icon

  return (
    <button
      type="button"
      aria-label={entry.label}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect?.(entry.id)}
      className={cn(
        "flex h-11 items-center justify-center rounded-full outline-none transition-[background-color,color,padding]",
        ease,
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        // Only the active item may shrink (its label truncates); inactive ones keep their 44 px target.
        active ? "min-w-0 bg-highlight px-3.5 text-highlight-foreground min-[380px]:px-4" : "w-11 shrink-0 text-muted-foreground"
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className="size-6 shrink-0" />
      <span
        aria-hidden
        className={cn(
          "min-w-0 truncate text-sm leading-5 font-medium transition-[max-width,margin,opacity]",
          ease,
          active ? "ml-2 max-w-24 opacity-100" : "ml-0 max-w-0 opacity-0"
        )}
      >
        {entry.label}
      </span>
    </button>
  )
}

/**
 * Mobile floating pill: permanent glass (GlassSurface). Inactive items are icon only; the active route expands into a Lima
 * pill with the label beside its icon. It takes the width it is given (flex-1, min-w-0) and spreads its items with
 * space-between, so it can never outgrow the screen; where it floats, and what sits next to it, is up to the caller.
 */
export function BottomNav({ items, activeId, onSelect, className }: BottomNavProps) {
  return (
    <GlassSurface as="nav" aria-label="Navegação principal" className={cn("flex h-16 min-w-0 items-center justify-between px-1.5 min-[380px]:px-2", className)}>
      {items.map((entry) => (
        <NavButton key={entry.id} entry={entry} active={activeId === entry.id} onSelect={onSelect} />
      ))}
    </GlassSurface>
  )
}
