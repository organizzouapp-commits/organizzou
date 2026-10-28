"use client"

import { memo, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, SearchIcon } from "lucide-react"

import { Logo } from "@/components/organizzou/Logo"
import { modules } from "@/components/organizzou/modules"
import { ThemeSwitch } from "@/components/organizzou/ThemeToggle"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { isActivePath, type ShellUser } from "./app-sidebar"
import { Bell, UserMenu } from "./app-topbar"
import { NAV_GROUPS } from "./nav"

const [MAIN_GROUP, ...FOLDED_GROUPS] = NAV_GROUPS

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const chip = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-[15px] transition-colors duration-[400ms] ease-organizzou motion-reduce:transition-none"
const chipIdle = "border-border text-muted-foreground"
const chipActive = "border-transparent bg-highlight font-medium text-highlight-foreground"

type MobileHeaderProps = {
  user: ShellUser
  onSearch: () => void
}

/**
 * Header below md. Not sticky: it scrolls away with the page. Three rows: avatar menu, logo and notifications; search and
 * theme switch; text-only module chips (Vida and Organização open their sub-items). Solid surfaces only, no blur.
 */
export const MobileHeader = memo(function MobileHeader({ user, onSearch }: MobileHeaderProps) {
  const pathname = usePathname()
  const chipsRef = useRef<HTMLElement>(null)

  // Keep the active chip visible: center it in the row whenever the route changes.
  useEffect(() => {
    const row = chipsRef.current
    const active = row?.querySelector<HTMLElement>("[data-active]")
    if (!row || !active) return
    const left = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    row.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" })
  }, [pathname])

  return (
    <header className="flex flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:hidden">
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
        <div className="flex size-11 items-center justify-center">
          <UserMenu user={user} compact />
        </div>
        <div className="flex justify-center">
          <Logo className="h-8" />
        </div>
        <Bell />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
          {/* Read-only: tapping hands over to the command palette, which owns the real input (and the keyboard). */}
          <Input
            readOnly
            type="text"
            aria-label="Buscar em tudo"
            placeholder="Buscar…"
            autoComplete="off"
            onClick={onSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSearch()
              }
            }}
            className="h-11 cursor-pointer rounded-full border-border bg-card pr-4 pl-11 text-[15px] md:h-11 dark:bg-card"
          />
        </div>
        <ThemeSwitch />
      </div>

      <nav ref={chipsRef} aria-label="Módulos" className="no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4">
        {MAIN_GROUP.items.map((id) => {
          const m = modules[id]
          const active = isActivePath(pathname, m.href)
          return (
            <Link
              key={id}
              href={m.href}
              data-active={active ? "" : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(chip, focus, active ? chipActive : chipIdle)}
            >
              {m.name}
            </Link>
          )
        })}
        {FOLDED_GROUPS.map((group) => {
          const active = group.items.some((id) => isActivePath(pathname, modules[id].href))
          return (
            <DropdownMenu key={group.label}>
              <DropdownMenuTrigger asChild>
                <button type="button" data-active={active ? "" : undefined} className={cn(chip, focus, "data-[state=open]:border-foreground/30", active ? chipActive : chipIdle)}>
                  {group.label}
                  <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-auto min-w-56 rounded-2xl p-2">
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
    </header>
  )
})
