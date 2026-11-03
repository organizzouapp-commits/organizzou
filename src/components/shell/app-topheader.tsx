"use client"

import { memo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, FolderIcon, LogOutIcon, SettingsIcon } from "lucide-react"

import { HeaderActions, headerGroup as group } from "@/components/organizzou/header-actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { APP_PLAN_ITEM } from "./app-nav"
import type { ShellUser } from "./app-sidebar"
import { groupHasActive, isActivePath, useNav, type NavItem } from "./nav-config"
import { useRequestSignOut } from "./sign-out-dialog"

const ease = "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const pill = "inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] 2xl:px-4"
const pillIdle = "text-foreground hover:bg-accent"
const pillActive = "bg-highlight font-medium text-highlight-foreground"

/** Below 1024 px (max-[1024px] means width < 1024 in Tailwind 4) the pills are icon-only so the header never runs into the actions on its right. */
const labelOnWide = "max-[1024px]:hidden"
const iconOnNarrow = "size-[18px] shrink-0 min-[1024px]:hidden"

const menuItem = "min-h-11 gap-3 rounded-xl px-3 py-2 text-[15px]"
const menuActive = "bg-highlight font-medium text-highlight-foreground focus:bg-highlight focus:text-highlight-foreground"

type TopHeaderProps = {
  user: ShellUser
  onSearch: (query: string) => void
}

/**
 * Header of the COLLAPSED layout (desktop). The header itself is transparent (the page background shows through); only the
 * groups in it have a surface: text-only navigation pills, theme switch, search + notifications, account, and the primary
 * action. No backdrop-filter. The expanded sidebar layout keeps AppTopBar.
 */
/** "Configurações" pill of the collapsed header: same items as the sidebar group, plus Plano e cobrança and Sair. Icon-only below 1200 px. */
function AccountPill({ account, active, pathname, tabIndex, onFocus }: { account: { label: string; items: NavItem[] }; active: boolean; pathname: string; tabIndex: number; onFocus: () => void }) {
  const requestSignOut = useRequestSignOut()
  const items = [...account.items, APP_PLAN_ITEM]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-nav-item tabIndex={tabIndex} onFocus={onFocus} aria-label={account.label} title={account.label} className={cn(pill, ease, focus, active ? pillActive : pillIdle)}>
          <SettingsIcon aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 min-[1200px]:hidden" />
          <span className="hidden min-[1200px]:inline">{account.label}</span>
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 opacity-60 max-[1024px]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-auto min-w-56 rounded-2xl p-2">
        {items.map((item) => {
          const itemActive = isActivePath(pathname, item.href)
          return (
            <DropdownMenuItem key={item.id} asChild className={cn(menuItem, itemActive && menuActive)}>
              <Link href={item.href} aria-current={itemActive ? "page" : undefined}>
                <item.icon strokeWidth={1.75} className="size-[18px]" /> {item.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator className="mx-1 my-2" />
        <DropdownMenuItem onSelect={requestSignOut} className={menuItem}>
          <LogOutIcon strokeWidth={1.75} className="size-[18px]" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const AppTopHeader = memo(function AppTopHeader({ user, onSearch }: TopHeaderProps) {
  const pathname = usePathname()
  const nav = useNav()
  const [mainGroup, ...foldedGroups] = nav.groups
  const accountPaths = nav.account ? [...nav.account.items.map((item) => item.href), APP_PLAN_ITEM.href] : []
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const entries = [
    ...mainGroup.items.map((item) => ({ kind: "link" as const, item })),
    ...foldedGroups.map((g) => ({ kind: "group" as const, group: g })),
    ...(nav.account ? [{ kind: "account" as const, account: nav.account }] : []),
  ]
  const activeIndex = entries.findIndex((e) =>
    e.kind === "link" ? isActivePath(pathname, e.item.href) : e.kind === "group" ? groupHasActive(e.group, pathname) : accountPaths.some((href) => isActivePath(pathname, href))
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
            const m = entry.item
            const active = isActivePath(pathname, m.href)
            return (
              <Link
                key={m.id}
                href={m.href}
                data-nav-item
                tabIndex={tabIndex}
                onFocus={onFocus}
                aria-current={active ? "page" : undefined}
                aria-label={m.label}
                title={m.label}
                className={cn(pill, ease, focus, active ? pillActive : pillIdle)}
              >
                <m.icon aria-hidden strokeWidth={1.75} className={iconOnNarrow} />
                <span className={labelOnWide}>{m.label}</span>
              </Link>
            )
          }
          if (entry.kind === "account") {
            return <AccountPill key="account" account={entry.account} active={index === activeIndex} pathname={pathname} tabIndex={tabIndex} onFocus={onFocus} />
          }
          const { group: g } = entry
          const active = index === activeIndex
          const GroupIcon = g.icon ?? FolderIcon
          return (
            <DropdownMenu key={g.label}>
              <DropdownMenuTrigger asChild>
                <button type="button" data-nav-item tabIndex={tabIndex} onFocus={onFocus} aria-label={g.label} title={g.label} className={cn(pill, ease, focus, active ? pillActive : pillIdle)}>
                  <GroupIcon aria-hidden strokeWidth={1.75} className={iconOnNarrow} />
                  <span className={labelOnWide}>{g.label}</span>
                  <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 opacity-60 max-[1024px]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={12} className="w-auto min-w-56 rounded-2xl p-2">
                {g.items.map((m) => {
                  const itemActive = isActivePath(pathname, m.href)
                  return (
                    <DropdownMenuItem
                      key={m.id}
                      asChild
                      className={cn("min-h-11 gap-3 rounded-xl px-3 py-2 text-[15px]", itemActive && "bg-highlight font-medium text-highlight-foreground focus:bg-highlight focus:text-highlight-foreground")}
                    >
                      <Link href={m.href} aria-current={itemActive ? "page" : undefined}>
                        <m.icon strokeWidth={1.75} className="size-[18px]" /> {m.label}
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
