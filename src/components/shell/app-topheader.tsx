"use client"

import { memo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, FolderIcon, PlusIcon, SearchIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { Logo } from "@/components/organizzou/Logo"
import { modules } from "@/components/organizzou/modules"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { GROUP_ICONS, isActivePath, type ShellUser } from "./app-sidebar"
import { Bell, UserMenu } from "./app-topbar"
import { NAV_GROUPS } from "./nav"
import { usePrimaryActionValue } from "./primary-action"

const [MAIN_GROUP, ...FOLDED_GROUPS] = NAV_GROUPS

const ease = "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const pill = "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-[15px]"
const pillIdle = "text-sidebar-foreground hover:bg-sidebar-accent"
const pillActive = "bg-highlight font-medium text-highlight-foreground"

/** Nav pills show their label from 1360 px (1480 px while the inline search is open); below that they are icons with a tooltip. */
function PillTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The search icon expands into the input (width animation, 0.4 s). Typing hands the text to the command palette, which does
 * the real searching (Ctrl K still opens it directly). Esc, or leaving the field empty, closes it again.
 */
function InlineSearch({ open, onOpenChange, onSearch }: { open: boolean; onOpenChange: (open: boolean) => void; onSearch: (query: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget) && !inputRef.current?.value) onOpenChange(false)
      }}
      className={cn(
        "flex h-11 shrink-0 items-center overflow-hidden rounded-full border border-border bg-card transition-[width] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
        open ? "w-56" : "w-11 hover:bg-accent"
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
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", focus)}
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
        className="min-w-0 flex-1 bg-transparent pr-4 text-[15px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

type TopHeaderProps = {
  user: ShellUser
  onSearch: (query: string) => void
}

/**
 * Header of the COLLAPSED layout (desktop): logo, main navigation as pills, search, notifications, account menu and the
 * primary action. Solid surface and radius like the rail below it, no backdrop-filter. The expanded sidebar layout keeps AppTopBar.
 */
export const AppTopHeader = memo(function AppTopHeader({ user, onSearch }: TopHeaderProps) {
  const pathname = usePathname()
  const { openQuickCapture } = useAssistant()
  const primary = usePrimaryActionValue()
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const label = searchOpen ? "hidden min-[1480px]:inline" : "hidden min-[1360px]:inline"
  const chevron = searchOpen ? "hidden min-[1480px]:block" : "hidden min-[1360px]:block"
  const padding = searchOpen ? "min-[1480px]:px-4" : "min-[1360px]:px-4"

  const entries = [
    ...MAIN_GROUP.items.map((id) => ({ kind: "link" as const, id })),
    ...FOLDED_GROUPS.map((group) => ({ kind: "group" as const, group })),
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
    <header className="absolute inset-x-4 top-4 z-20 hidden h-16 items-center gap-3 rounded-[24px] border border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:flex">
      <Link href="/dashboard" aria-label="Organizzou — Hoje" className={cn("flex shrink-0 items-center rounded-xl px-1", focus)}>
        <span className="hidden lg:block">
          <Logo className="h-8" />
        </span>
        <span className="lg:hidden">
          <Logo iconOnly className="size-10" />
        </span>
      </Link>

      <nav
        ref={navRef}
        aria-label="Módulos"
        onKeyDown={onNavKeyDown}
        className="mx-auto flex h-[52px] min-w-0 shrink items-center gap-1 rounded-full bg-sidebar-accent p-1"
      >
        {entries.map((entry, index) => {
          const tabIndex = index === tabStop ? 0 : -1
          const onFocus = () => setFocusIndex(index)
          if (entry.kind === "link") {
            const m = modules[entry.id]
            const active = isActivePath(pathname, m.href)
            return (
              <PillTip key={entry.id} label={m.name}>
                <Link
                  href={m.href}
                  data-nav-item
                  tabIndex={tabIndex}
                  onFocus={onFocus}
                  aria-label={m.name}
                  aria-current={active ? "page" : undefined}
                  className={cn(pill, padding, ease, focus, active ? pillActive : pillIdle)}
                >
                  <m.icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
                  <span className={label}>{m.name}</span>
                </Link>
              </PillTip>
            )
          }
          const { group } = entry
          const Icon = GROUP_ICONS[group.label] ?? FolderIcon
          const active = index === activeIndex
          return (
            <DropdownMenu key={group.label}>
              <PillTip label={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-nav-item
                    tabIndex={tabIndex}
                    onFocus={onFocus}
                    aria-label={group.label}
                    className={cn(pill, padding, ease, focus, active ? pillActive : pillIdle)}
                  >
                    <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
                    <span className={label}>{group.label}</span>
                    <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 opacity-60", chevron)} />
                  </button>
                </DropdownMenuTrigger>
              </PillTip>
              <DropdownMenuContent align="center" sideOffset={12} className="w-auto min-w-56 rounded-2xl p-2">
                {group.items.map((id) => {
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

      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <InlineSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={onSearch} />
        <Bell />
        <UserMenu user={user} header />
        <Button size="lg" className="h-11 rounded-full px-4 lg:px-5" onClick={primary?.onClick ?? openQuickCapture}>
          <PlusIcon strokeWidth={1.75} /> {primary?.label ?? "Novo"}
        </Button>
      </div>
    </header>
  )
})
