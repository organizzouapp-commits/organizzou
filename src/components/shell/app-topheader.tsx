"use client"

import { memo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, PlusIcon, SearchIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { modules } from "@/components/organizzou/modules"
import { ThemeSwitch } from "@/components/organizzou/ThemeToggle"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { isActivePath, type ShellUser } from "./app-sidebar"
import { Bell, UserMenu } from "./app-topbar"
import { NAV_GROUPS } from "./nav"
import { usePrimaryActionValue } from "./primary-action"

const [MAIN_GROUP, ...FOLDED_GROUPS] = NAV_GROUPS

const ease = "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
/** Solid surface of every group in the header: the card token, hairline border, fully rounded, 44 px tall. */
const group = "flex h-11 shrink-0 items-center rounded-full border border-border bg-card"
const pill = "inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] 2xl:px-4"
const pillIdle = "text-foreground hover:bg-accent"
const pillActive = "bg-highlight font-medium text-highlight-foreground"

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

type TopHeaderProps = {
  user: ShellUser
  onSearch: (query: string) => void
}

/**
 * Header of the COLLAPSED layout (desktop). The header itself is transparent (the page background shows through); only the
 * groups in it have a surface: text-only navigation pills, theme switch, search + notifications, account, and the primary
 * action. No backdrop-filter. The expanded sidebar layout keeps AppTopBar.
 */
export const AppTopHeader = memo(function AppTopHeader({ user, onSearch }: TopHeaderProps) {
  const pathname = usePathname()
  const { openQuickCapture } = useAssistant()
  const primary = usePrimaryActionValue()
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const primaryLabel = primary?.label ?? "Novo"

  const entries = [
    ...MAIN_GROUP.items.map((id) => ({ kind: "link" as const, id })),
    ...FOLDED_GROUPS.map((g) => ({ kind: "group" as const, group: g })),
  ]
  const activeIndex = entries.findIndex((e) =>
    e.kind === "link" ? isActivePath(pathname, modules[e.id].href) : e.group.items.some((id) => isActivePath(pathname, modules[id].href))
  )
  const tabStop = focusIndex ?? Math.max(activeIndex, 0)

  // Roving focus: one tab stop for the whole nav, arrows/Home/End move between the pills.
  function onNavKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    const items = Array.from(navRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]") ?? [])
    const current = items.indexOf(document.activeElement as HTMLElement)
    if (current < 0) return
    event.preventDefault()
    const step = event.key === "ArrowRight" ? 1 : -1
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + step + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <header className="pointer-events-none absolute inset-x-4 top-4 z-20 hidden h-11 items-center gap-3 text-foreground md:flex [&>*]:pointer-events-auto">
      <nav ref={navRef} aria-label="Módulos" onKeyDown={onNavKeyDown} className={cn(group, "min-w-0 gap-0.5 p-[3px]")}>
        {entries.map((entry, index) => {
          const tabIndex = index === tabStop ? 0 : -1
          const onFocus = () => setFocusIndex(index)
          if (entry.kind === "link") {
            const m = modules[entry.id]
            const active = isActivePath(pathname, m.href)
            return (
              <Link
                key={entry.id}
                href={m.href}
                data-nav-item
                tabIndex={tabIndex}
                onFocus={onFocus}
                aria-current={active ? "page" : undefined}
                className={cn(pill, ease, focus, active ? pillActive : pillIdle)}
              >
                {m.name}
              </Link>
            )
          }
          const { group: g } = entry
          const active = index === activeIndex
          return (
            <DropdownMenu key={g.label}>
              <DropdownMenuTrigger asChild>
                <button type="button" data-nav-item tabIndex={tabIndex} onFocus={onFocus} className={cn(pill, ease, focus, active ? pillActive : pillIdle)}>
                  {g.label}
                  <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={12} className="w-auto min-w-56 rounded-2xl p-2">
                {g.items.map((id) => {
                  const m = modules[id]
                  const itemActive = isActivePath(pathname, m.href)
                  return (
                    <DropdownMenuItem
                      key={id}
                      asChild
                      className={cn("min-h-11 gap-3 rounded-xl px-3 py-2 text-[15px]", itemActive && "bg-highlight font-medium text-highlight-foreground focus:bg-highlight focus:text-highlight-foreground")}
                    >
                      <Link href={m.href} aria-current={itemActive ? "page" : undefined}>
                        <m.icon strokeWidth={1.75} className="size-[18px]" /> {m.name}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <ThemeSwitch />
        <div className={cn(group, "px-0.5")}>
          <InlineSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={onSearch} />
          <Bell bare />
        </div>
        <div className={cn(group, "p-[3px]")}>
          <UserMenu user={user} header />
        </div>
        <Button size="lg" className="h-11 rounded-full px-3 min-[1280px]:px-5" aria-label={primaryLabel} onClick={primary?.onClick ?? openQuickCapture}>
          <PlusIcon strokeWidth={1.75} /> <span className="hidden min-[1280px]:inline">{primaryLabel}</span>
        </Button>
      </div>
    </header>
  )
})
