"use client"

import { memo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon } from "lucide-react"

import { modules } from "@/components/organizzou/modules"
import { HeaderActions, headerGroup as group } from "@/components/organizzou/header-actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { isActivePath, type ShellUser } from "./app-sidebar"
import { NAV_GROUPS } from "./nav"

const [MAIN_GROUP, ...FOLDED_GROUPS] = NAV_GROUPS

const ease = "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const pill = "inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] 2xl:px-4"
const pillIdle = "text-foreground hover:bg-accent"
const pillActive = "bg-highlight font-medium text-highlight-foreground"

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
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)

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

      <div className="ml-auto">
        <HeaderActions user={user} onSearch={onSearch} />
      </div>
    </header>
  )
})
