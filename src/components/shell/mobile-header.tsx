"use client"

import { memo, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, SearchIcon } from "lucide-react"

import { GlassSurface } from "@/components/organizzou/GlassSurface"
import { Logo } from "@/components/organizzou/Logo"
import { modules } from "@/components/organizzou/modules"
import { ThemeSwitch } from "@/components/organizzou/ThemeToggle"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { isActivePath, type ShellUser } from "./app-sidebar"
import { Bell, UserMenu } from "./app-topbar"
import { NAV_GROUPS } from "./nav"

const [MAIN_GROUP, ...FOLDED_GROUPS] = NAV_GROUPS

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const chip = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] transition-colors duration-[400ms] ease-organizzou motion-reduce:transition-none"
const chipActive = "border border-transparent bg-highlight font-medium text-highlight-foreground"
// Idle chips are glass; GlassSurface clips to the pill, so their focus ring is drawn inside.
const chipIdle = "text-muted-foreground focus-visible:ring-inset"

/** Glass pill, or the solid Lima pill when it is the current route. */
function ChipLink({ active, className, ...props }: Omit<React.ComponentProps<typeof Link>, "as"> & { active: boolean }) {
  if (active) return <Link aria-current="page" className={cn(chip, focus, chipActive, className)} {...props} />
  return <GlassSurface as={Link} className={cn(chip, focus, chipIdle, className)} {...props} />
}

function ChipButton({ active, className, ...props }: React.ComponentProps<"button"> & { active: boolean }) {
  if (active) return <button type="button" className={cn(chip, focus, chipActive, className)} {...props} />
  return <GlassSurface as="button" type="button" className={cn(chip, focus, chipIdle, className)} {...props} />
}

type MobileHeaderProps = {
  user: ShellUser
  onSearch: () => void
}

/**
 * Header below md. Not sticky: it scrolls away with the page. Three rows: avatar menu, logo and notifications; search and
 * theme switch; text-only module chips (glass when idle; Vida and Organização open their sub-items). Once the header has
 * scrolled out of view, a compact glass bar slides in at the top (it is never visible together with the full header).
 */
export const MobileHeader = memo(function MobileHeader({ user, onSearch }: MobileHeaderProps) {
  const pathname = usePathname()
  const chipsRef = useRef<HTMLElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  // Keep the active chip visible: center it in the row whenever the route changes.
  useEffect(() => {
    const row = chipsRef.current
    const active = row?.querySelector<HTMLElement>("[data-active]")
    if (!row || !active) return
    const left = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    row.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" })
  }, [pathname])

  // A 1 px sentinel at the end of the header: when it leaves through the top, the header is gone. No scroll listeners.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <header className="relative flex flex-col gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:hidden">
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
              <ChipLink key={id} href={m.href} active={active} data-active={active ? "" : undefined}>
                {m.name}
              </ChipLink>
            )
          })}
          {FOLDED_GROUPS.map((group) => {
            const active = group.items.some((id) => isActivePath(pathname, modules[id].href))
            return (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <ChipButton active={active} data-active={active ? "" : undefined}>
                    {group.label}
                    <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 opacity-60" />
                  </ChipButton>
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
        <div ref={sentinelRef} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </header>

      {/* Animated with top + opacity (not transform): a transformed ancestor would capture the glass layer's fixed positioning. */}
      <GlassSurface
        as="div"
        inert={!compact}
        className={cn(
          "fixed inset-x-4 z-30 grid h-14 grid-cols-[1fr_auto_1fr] items-center px-1.5 transition-[top,opacity] duration-[400ms] ease-organizzou motion-reduce:transition-none md:hidden",
          compact ? "top-[calc(env(safe-area-inset-top)+0.5rem)] opacity-100" : "pointer-events-none top-[-6rem] opacity-0"
        )}
      >
        <div className="flex items-center">
          <UserMenu user={user} compact />
        </div>
        <Logo className="h-7" />
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="icon" className="size-10 rounded-full md:size-10" aria-label="Buscar" onClick={onSearch}>
            <SearchIcon strokeWidth={1.75} />
          </Button>
          <Bell bare />
        </div>
      </GlassSurface>
    </>
  )
})
