"use client"

import { useRef, useState } from "react"
import { PlusIcon, SearchIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { ThemeSwitch } from "@/components/organizzou/ThemeToggle"
import { Button } from "@/components/ui/button"
import { Bell, UserMenu } from "@/components/shell/app-topbar"
import type { ShellUser } from "@/components/shell/app-sidebar"
import { usePrimaryActionValue } from "@/components/shell/primary-action"
import { cn } from "@/lib/utils"

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
/** Solid surface of every group in the header: the card token, hairline border, fully rounded, 44 px tall. */
export const headerGroup = "flex h-11 shrink-0 items-center rounded-full border border-border bg-card"

/**
 * The search icon expands into the input (width animation, 0.4 s) inside its pill group. Typing hands the text to the command
 * palette, which does the real searching (Ctrl K still opens it directly). Esc, or leaving the field empty, closes it again.
 */
function InlineSearch({ open, onOpenChange, onSearch }: { open: boolean; onOpenChange: (open: boolean) => void; onSearch: (query: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget) && !inputRef.current?.value) onOpenChange(false)
      }}
      className={cn(
        "flex h-10 shrink-0 items-center overflow-hidden rounded-full transition-[width] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
        open ? "w-40 2xl:w-56" : "w-10 hover:bg-accent"
      )}
    >
      <button
        type="button"
        aria-label="Buscar"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            onSearch(inputRef.current?.value ?? "")
            onOpenChange(false)
          } else {
            onOpenChange(true)
            inputRef.current?.focus()
          }
        }}
        className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", focus)}
      >
        <SearchIcon aria-hidden strokeWidth={1.75} className="size-[18px]" />
      </button>
      <input
        ref={inputRef}
        type="text"
        aria-label="Buscar em tudo"
        placeholder="Buscar…"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        autoComplete="off"
        onChange={(event) => {
          const value = event.target.value
          if (!value) return
          event.target.value = ""
          onOpenChange(false)
          onSearch(value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            onOpenChange(false)
          }
        }}
        className="min-w-0 flex-1 bg-transparent pr-3 text-[15px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

/**
 * Right-hand controls of the desktop header, shared by the collapsed layout (AppTopHeader) and the expanded one (AppTopBar)
 * so the two can never diverge: theme switch, search + notifications, account, and the primary action.
 */
export function HeaderActions({ user, onSearch }: { user: ShellUser; onSearch: (query: string) => void }) {
  const { openQuickCapture } = useAssistant()
  const primary = usePrimaryActionValue()
  const [searchOpen, setSearchOpen] = useState(false)
  const primaryLabel = primary?.label ?? "Novo"

  return (
    <div className="flex shrink-0 items-center gap-3">
      <ThemeSwitch />
      <div className={cn(headerGroup, "px-0.5")}>
        <InlineSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={onSearch} />
        <Bell bare />
      </div>
      <div className={cn(headerGroup, "p-[3px]")}>
        <UserMenu user={user} header />
      </div>
      <Button size="lg" className="h-11 rounded-full px-3 min-[1280px]:px-5" aria-label={primaryLabel} onClick={primary?.onClick ?? openQuickCapture}>
        <PlusIcon strokeWidth={1.75} /> <span className="hidden min-[1280px]:inline">{primaryLabel}</span>
      </Button>
    </div>
  )
}
