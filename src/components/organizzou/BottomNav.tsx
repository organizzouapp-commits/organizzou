"use client"

import { PlusIcon, type LucideIcon } from "lucide-react"

import { GlassSurface } from "@/components/organizzou/GlassSurface"
import { cn } from "@/lib/utils"

export type BottomNavItem = {
  id: string
  label: string
  icon: LucideIcon
}

type BottomNavProps = {
  /** Exactly 4 items; the "+" action ("Novo") sits in the middle, between the second and the third. */
  items: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem]
  /** Id of the current route's item, or "" when none of them is active. */
  activeId: string
  onSelect?: (id: string) => void
  onAdd?: () => void
  className?: string
}

// Five equal columns. The icon sits in a 28 px box (the "+" circle is 40 px and overhangs it by 6 px on both sides), so the
// icons share one center line and the labels share one line, whatever the item.
const item = "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl outline-none transition-colors duration-[400ms] ease-organizzou focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
const label = "max-w-full truncate text-[11px] leading-none font-medium"

function NavButton({ entry, active, onSelect }: { entry: BottomNavItem; active: boolean; onSelect?: (id: string) => void }) {
  const Icon = entry.icon

  return (
    <button
      type="button"
      aria-label={entry.label}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect?.(entry.id)}
      className={cn(item, active ? "bg-highlight text-highlight-foreground" : "text-muted-foreground")}
    >
      <span className="flex h-7 items-center justify-center">
        <Icon aria-hidden strokeWidth={1.75} className="size-6" />
      </span>
      <span className={label}>{entry.label}</span>
    </button>
  )
}

/**
 * Mobile floating pill: permanent glass (GlassSurface), hairline border, no shadow. Five equal items, each an icon with its
 * label below; the active route gets a Lima rounded background. The middle "+" is a regular item in the same row (a Lima
 * circle labelled "Novo"), not raised. It takes the width it is given (flex-1), so it can never outgrow the screen; where it
 * floats is up to the caller, which also decides what sits next to it.
 */
export function BottomNav({ items, activeId, onSelect, onAdd, className }: BottomNavProps) {
  const [first, second, third, fourth] = items

  return (
    <GlassSurface as="nav" aria-label="Navegação principal" className={cn("flex h-16 min-w-0 items-center px-2", className)}>
      <NavButton entry={first} active={activeId === first.id} onSelect={onSelect} />
      <NavButton entry={second} active={activeId === second.id} onSelect={onSelect} />
      <button type="button" aria-label="Criar novo" onClick={onAdd} className={cn(item, "text-muted-foreground")}>
        <span className="flex h-7 items-center justify-center">
          <span className="-my-1.5 flex size-10 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
            <PlusIcon aria-hidden strokeWidth={1.75} className="size-6" />
          </span>
        </span>
        <span className={label}>Novo</span>
      </button>
      <NavButton entry={third} active={activeId === third.id} onSelect={onSelect} />
      <NavButton entry={fourth} active={activeId === fourth.id} onSelect={onSelect} />
    </GlassSurface>
  )
}
