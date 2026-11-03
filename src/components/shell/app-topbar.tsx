"use client"

import { memo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { format, formatDistanceToNowStrict } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlarmClockIcon, ArrowLeftIcon, BellIcon, CalendarDaysIcon, ChevronDownIcon, ChevronRightIcon, DumbbellIcon, GraduationCapIcon, InfoIcon, LogOutIcon, ReceiptTextIcon, RepeatIcon, ShieldIcon, SquareCheckIcon, TargetIcon, type LucideIcon } from "lucide-react"

import { HeaderActions } from "@/components/organizzou/header-actions"
import { usePlan } from "@/components/organizzou/plan-context"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { NotificationKind } from "@/features/notifications/types"
import { greeting, inTz } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { SP_TIMEZONE } from "@/lib/sp-time"

import type { ShellUser } from "./app-sidebar"
import { BACK_TO_APP_HREF } from "./nav-brand"
import { metaFor, useNavContext } from "./nav-config"
import { useNotifications } from "./notifications"
import { useRequestSignOut } from "./sign-out-dialog"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

type AppTopBarProps = {
  user: ShellUser
  nowIso: string
  /** Desktop inline search: hands the typed text to the command palette. */
  onSearchWith: (query: string) => void
  /** The collapsed layout replaces the desktop header with TopHeader. */
  hideDesktop?: boolean
}

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  info: InfoIcon,
  task: SquareCheckIcon,
  agenda: CalendarDaysIcon,
  bill: ReceiptTextIcon,
  habit: RepeatIcon,
  workout: DumbbellIcon,
  study: GraduationCapIcon,
  goal: TargetIcon,
  reminder: AlarmClockIcon,
}

const PAGE = 50

/**
 * The panel's scroll region: it takes whatever height the capped panel has left (flex-1, min-h-0), scrolls on its own and keeps the
 * page behind still (overscroll-behavior: contain). It is a focusable region, so the arrow keys scroll it. `onScrolled` tells the
 * header when to draw its hairline.
 */
function NotificationScroll({ onScrolled, children }: { onScrolled: (scrolled: boolean) => void; children: React.ReactNode }) {
  return (
    <div
      role="region"
      aria-label="Lista de notificações"
      tabIndex={0}
      data-testid="notifications-scroll"
      onScroll={(event) => onScrolled(event.currentTarget.scrollTop > 0)}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 outline-none [scrollbar-color:var(--border)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      {children}
    </div>
  )
}

/**
 * The bell. It lists the person's own notifications (newest first): unread ones carry a Lima dot, tapping one marks it read and opens
 * what it is about, "Marcar todas como lidas" clears the dot, and with nothing to show it says so. The dot on the bell is the unread
 * count > 0. `bare`: no border or fill of its own, for use inside a pill group (the collapsed header).
 */
export function Bell({ bare = false }: { bare?: boolean }) {
  const { items, unread, markRead, markAllRead } = useNotifications()
  const [scrolled, setScrolled] = useState(false)
  const [shown, setShown] = useState(PAGE)
  return (
    <Popover onOpenChange={() => setScrolled(false)}>
      <PopoverTrigger asChild>
        <Button variant={bare ? "ghost" : "surface"} size="icon" className={cn("relative rounded-full", bare && "size-10 md:size-10")} aria-label={unread > 0 ? `Notificações, ${unread} ${unread === 1 ? "nova" : "novas"}` : "Notificações"}>
          <BellIcon strokeWidth={1.75} />
          {unread > 0 ? <span aria-hidden data-testid="bell-dot" className={cn("absolute top-2 right-2.5 size-2 rounded-full bg-highlight ring-2", bare ? "ring-card" : "ring-background")} /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[min(480px,70dvh)] w-80 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 max-md:max-h-[min(360px,55dvh)] max-md:[@media(max-height:500px)]:max-h-[70dvh]">
        <div className={cn("flex shrink-0 items-center justify-between gap-2 border-b px-5 py-2 max-md:h-12 max-md:py-0 transition-colors duration-[400ms] motion-reduce:transition-none", scrolled ? "border-border" : "border-transparent")}>
          <p className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Notificações</p>
          {unread > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-3 text-[13px]" onClick={markAllRead}>
              Marcar todas como lidas
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-4 text-[15px] leading-6 text-muted-foreground">Nada novo por aqui. Os avisos do app chegam aqui.</p>
        ) : (
          <NotificationScroll onScrolled={setScrolled}>
            <ul>
            {items.slice(0, shown).map((n) => {
              const Icon = KIND_ICONS[n.kind] ?? InfoIcon
              const row = (
                <>
                  <Icon aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("text-[15px] leading-5 max-md:truncate max-md:text-[14px] max-md:font-semibold", !n.read_at && "font-medium")}>{n.title}</span>
                    {n.body ? <span className="text-[13px] leading-5 text-muted-foreground max-md:hidden">{n.body}</span> : null}
                    <span className="text-[12px] leading-4 text-muted-foreground max-md:truncate">{formatDistanceToNowStrict(new Date(n.created_at), { locale: ptBR, addSuffix: true })}</span>
                  </span>
                  {!n.read_at ? <span aria-label="Não lida" role="img" className="mt-1.5 size-2 shrink-0 rounded-full bg-highlight" /> : null}
                </>
              )
              const className = "flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left max-md:min-h-[56px] max-md:items-center max-md:px-4 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              return (
                <li key={n.id} data-read={n.read_at ? "" : undefined}>
                  {n.link ? (
                    <Link href={n.link} onClick={() => markRead(n.id)} className={className}>
                      {row}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => markRead(n.id)} className={className}>
                      {row}
                    </button>
                  )}
                </li>
              )
            })}
            </ul>
            {items.length > shown ? (
              <Button type="button" variant="ghost" className="mt-1 h-11 w-full rounded-full text-[15px]" onClick={() => setShown((n) => n + PAGE)}>
                Carregar mais
              </Button>
            ) : null}
          </NotificationScroll>
        )}
      </PopoverContent>
    </Popover>
  )
}

const menuItem = "min-h-11 gap-3 rounded-xl px-3 py-2 text-[15px]"
const menuIcon = "size-[18px]"

/**
 * `header`: the collapsed layout's top header, which sits inside its own pill group and shows the name and e-mail from 1440 px.
 * `compact`: avatar only (mobile header).
 */
export function UserMenu({ user, compact = false, header = false }: { user: ShellUser; compact?: boolean; header?: boolean }) {
  const requestSignOut = useRequestSignOut()
  const { definition, pro } = usePlan()
  const { nav, isAdmin } = useNavContext()
  const inAdmin = nav.id === "admin"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu da conta"
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-full text-left outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
            header ? "h-9 pr-2 min-[1440px]:pr-3" : "p-1 md:pr-3"
          )}
        >
          <Avatar className={cn("shrink-0", header ? "size-9" : "size-10")}>
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          {compact ? null : (
            <>
              <span className="hidden min-w-0 flex-col leading-tight min-[1440px]:flex">
                <span className="max-w-40 truncate text-[15px] font-medium">{user.name}</span>
                <span className="max-w-40 truncate text-[13px] text-muted-foreground">{user.email}</span>
              </span>
              <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "start" : "end"} sideOffset={8} collisionPadding={16} className="w-auto max-w-[calc(100vw-2rem)] min-w-60 rounded-2xl p-2">
        <DropdownMenuLabel className="flex min-w-0 flex-col px-3 py-3 leading-tight">
          <span className="truncate text-[15px] font-medium text-foreground">{user.name}</span>
          <span className="truncate text-[13px] font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        {nav.features.plan ? (
          <div className="flex items-center justify-between gap-3 p-3 pt-0">
            <Badge className={cn("rounded-full", pro ? "bg-highlight text-highlight-foreground" : "bg-muted text-muted-foreground")}>{definition.name}</Badge>
            <DropdownMenuItem asChild className="size-8 justify-center rounded-full border border-border p-0">
              <Link href="/dashboard/plano" aria-label="Ver planos">
                <ChevronRightIcon strokeWidth={1.75} className="size-4" />
              </Link>
            </DropdownMenuItem>
          </div>
        ) : null}
        <DropdownMenuSeparator className="mx-1 my-2" />
        {inAdmin ? (
          <DropdownMenuItem asChild className={menuItem}>
            <Link href={BACK_TO_APP_HREF}>
              <ArrowLeftIcon strokeWidth={1.75} className={menuIcon} /> Voltar ao app
            </Link>
          </DropdownMenuItem>
        ) : null}
        {(nav.account?.items ?? []).map((item) => (
          <DropdownMenuItem key={item.id} asChild className={menuItem}>
            <Link href={item.href}>
              <item.icon strokeWidth={1.75} className={menuIcon} /> {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {isAdmin && !inAdmin ? (
          <DropdownMenuItem asChild className={menuItem}>
            <Link href="/admin">
              <ShieldIcon strokeWidth={1.75} className={menuIcon} /> Área do admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="mx-1 my-2" />
        <DropdownMenuItem onSelect={requestSignOut} className={menuItem}>
          <LogOutIcon strokeWidth={1.75} className={menuIcon} /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Title and subtitle of the current page ("Boa tarde, Ana" on the home screen). */
export function usePageHeading(user: ShellUser, nowIso: string) {
  const pathname = usePathname()
  const { nav } = useNavContext()
  const now = new Date(nowIso)
  const firstName = user.name.split(" ")[0]
  const meta = metaFor(nav, pathname)
  const isToday = nav.features.greeting && pathname === nav.home.href
  const title = isToday ? `${greeting(now, SP_TIMEZONE)}, ${firstName}` : (meta?.title ?? "Organizzou")
  const subtitle = isToday
    ? format(inTz(now, SP_TIMEZONE), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())
    : (meta?.subtitle ?? "")
  return { title, subtitle, isToday }
}

export const AppTopBar = memo(function AppTopBar({ user, nowIso, onSearchWith, hideDesktop = false }: AppTopBarProps) {
  const { title, subtitle } = usePageHeading(user, nowIso)

  return (
    <>
      {/* Desktop and tablet */}
      <header className={cn("hidden shrink-0 items-start justify-between gap-6 pb-4", !hideDesktop && "md:flex md:min-h-[76px]")}>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-[28px] leading-9 font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="truncate text-[15px] leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        <HeaderActions user={user} onSearch={onSearchWith} />
      </header>
    </>
  )
})
