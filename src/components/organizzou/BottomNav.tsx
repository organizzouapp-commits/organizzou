"use client"

import { PlusIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type BottomNavItem = {
  id: string
  label: string
  icon: LucideIcon
}

type BottomNavProps = {
  /** Exactly 4 items; the "+" action sits in the middle. */
  items: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem]
  activeId: string
  onSelect?: (id: string) => void
  onAdd?: () => void
  className?: string
}

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: BottomNavItem
  active: boolean
  onSelect?: (id: string) => void
}) {
  const Icon = item.icon

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect?.(item.id)}
      className="flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        className={cn(
          "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 ease-organizzou",
          active && "bg-highlight text-highlight-foreground"
        )}
      >
        <Icon aria-hidden strokeWidth={1.75} className="size-6" />
      </span>
      <span className={cn("text-[11px] leading-4", active && "font-semibold text-foreground")}>
        {item.label}
      </span>
    </button>
  )
}

export function BottomNav({ items, activeId, onSelect, onAdd, className }: BottomNavProps) {
  const [first, second, third, fourth] = items

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "flex items-center border-t border-border bg-card px-2 pt-2 pb-3",
        className
      )}
    >
      <NavButton item={first} active={activeId === first.id} onSelect={onSelect} />
      <NavButton item={second} active={activeId === second.id} onSelect={onSelect} />
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          aria-label="Adicionar"
          onClick={onAdd}
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-transform duration-120 ease-organizzou focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        >
          <PlusIcon aria-hidden strokeWidth={1.75} className="size-6" />
        </button>
      </div>
      <NavButton item={third} active={activeId === third.id} onSelect={onSelect} />
      <NavButton item={fourth} active={activeId === fourth.id} onSelect={onSelect} />
    </nav>
  )
}
