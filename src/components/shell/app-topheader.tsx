"use client"

import { memo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BadgeDollarSignIcon, ChevronDownIcon, FolderIcon, LockIcon, LogOutIcon, MessageCircleIcon, SettingsIcon } from "lucide-react"

import { modules } from "@/components/organizzou/modules"
import { HeaderActions, headerGroup as group } from "@/components/organizzou/header-actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { ACCOUNT_GROUP_LABEL, ACCOUNT_ITEMS } from "./account-menu"
import { GROUP_ICONS, isActivePath, type ShellUser } from "./app-sidebar"
import { NAV_GROUPS } from "./nav"
import { useRequestSignOut } from "./sign-out-dialog"
import { useWhatsAppAccess } from "./whatsapp-cta"

const [MAIN_GROUP, ...FOLDED_GROUPS] = NAV_GROUPS

const ease = "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const pill = "inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] 2xl:px-4"
const pillIdle = "text-foreground hover:bg-accent"
const pillActive = "bg-highlight font-medium text-highlight-foreground"

/** Below 1024 px (max-[1024px] means width < 1024 in Tailwind 4) the pills are icon-only so the header never runs into the actions on its right. */
const labelOnWide = "max-[1024px]:hidden"
const iconOnNarrow = "size-[18px] shrink-0 min-[1024px]:hidden"

const PLAN_HREF = "/dashboard/plano"
const ACCOUNT_PATHS = [...ACCOUNT_ITEMS.map((item) => item.href), PLAN_HREF]
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
/** "Configurações" pill of the collapsed header: same items as the sidebar group, plus Plano e cobrança, WhatsApp (Pro) and Sair. Icon-only below 1200 px. */
function AccountPill({ active, pathname, tabIndex, onFocus }: { active: boolean; pathname: string; tabIndex: number; onFocus: () => void }) {
  const requestSignOut = useRequestSignOut()
  const whatsapp = useWhatsAppAccess()
  const items = [...ACCOUNT_ITEMS.map(({ id, label, href, icon }) => ({ id, label, href, icon })), { id: "plano", label: "Plano e cobrança", href: PLAN_HREF, icon: BadgeDollarSignIcon }]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-nav-item tabIndex={tabIndex} onFocus={onFocus} aria-label={ACCOUNT_GROUP_LABEL} title={ACCOUNT_GROUP_LABEL} className={cn(pill, ease, focus, active ? pillActive : pillIdle)}>
          <SettingsIcon aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 min-[1200px]:hidden" />
          <span className="hidden min-[1200px]:inline">{ACCOUNT_GROUP_LABEL}</span>
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
        {whatsapp.connected && !whatsapp.locked ? null : (
          <DropdownMenuItem asChild className={menuItem}>
            <Link href={whatsapp.href}>
              <MessageCircleIcon strokeWidth={1.75} className="size-[18px]" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                Conectar WhatsApp
                {whatsapp.locked ? <span className="text-[11px] text-muted-foreground">Plano Pro</span> : null}
              </span>
              {whatsapp.locked ? <LockIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" /> : null}
            </Link>
          </DropdownMenuItem>
        )}
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
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const entries = [
    ...MAIN_GROUP.items.map((id) => ({ kind: "link" as const, id })),
    ...FOLDED_GROUPS.map((g) => ({ kind: "group" as const, group: g })),
    { kind: "account" as const },
  ]
  const activeIndex = entries.findIndex((e) =>
    e.kind === "link"
      ? isActivePath(pathname, modules[e.id].href)
      : e.kind === "group"
        ? e.group.items.some((id) => isActivePath(pathname, modules[id].href))
        : ACCOUNT_PATHS.some((href) => isActivePath(pathname, href))
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
                aria-label={m.name}
                title={m.name}
                className={cn(pill, ease, focus, active ? pillActive : pillIdle)}
              >
                <m.icon aria-hidden strokeWidth={1.75} className={iconOnNarrow} />
                <span className={labelOnWide}>{m.name}</span>
              </Link>
            )
          }
          if (entry.kind === "account") {
            return <AccountPill key="account" active={index === activeIndex} pathname={pathname} tabIndex={tabIndex} onFocus={onFocus} />
          }
          const { group: g } = entry
          const active = index === activeIndex
          const GroupIcon = GROUP_ICONS[g.label] ?? FolderIcon
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
