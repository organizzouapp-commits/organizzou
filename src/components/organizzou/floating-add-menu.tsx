"use client"

import { PlusIcon, type LucideIcon } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTextEntryFocused } from "@/hooks/use-text-entry-focused"
import { cn } from "@/lib/utils"

export type FloatingAddItem = { id: string; label: string; icon: LucideIcon; onSelect: () => void }

/**
 * Phones: one round Lima "+" floating above the bottom nav row (right edge, above the assistant button), opening an upward menu.
 * It steps aside while a sheet or dialog is open (`hidden`) and while the keyboard is up. The menu is Radix: arrow keys, Esc, and focus
 * goes back to the button. Pair it with an invisible spacer (`FloatingAddSpacer`) so the last item of the page is never covered.
 */
export function FloatingAddMenu({ label, items, hidden }: { label: string; items: FloatingAddItem[]; hidden?: boolean }) {
  const typing = useTextEntryFocused()
  if (hidden || typing) return null
  return (
    <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-30 md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={label} aria-haspopup="menu" data-testid="floating-add" className={cn("flex size-14 items-center justify-center rounded-full bg-highlight text-highlight-foreground outline-none transition-transform duration-120 ease-organizzou focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95")}>
            <PlusIcon aria-hidden strokeWidth={1.75} className="size-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-52 rounded-[16px] p-1.5">
          {items.map(({ id, label: text, icon: Icon, onSelect }) => (
            <DropdownMenuItem key={id} data-testid={`floating-add-${id}`} className="min-h-11 gap-3 rounded-[12px] px-3 text-[15px]" onSelect={onSelect}>
              <Icon strokeWidth={1.75} /> {text}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Bottom room for the floating button, phones only. */
export function FloatingAddSpacer() {
  return <div aria-hidden data-testid="floating-add-spacer" className="h-20 shrink-0 md:hidden" />
}
