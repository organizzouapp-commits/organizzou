"use client"

import { memo, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BellIcon, ChevronDownIcon, ChevronRightIcon, LogOutIcon, MessageCircleIcon, SparklesIcon } from "lucide-react"

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
import { greeting, inTz } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { MOCK_TIMEZONE } from "@/mocks/time"

import type { ShellUser } from "./app-sidebar"
import { ACCOUNT_ITEMS } from "./account-menu"
import { metaFor } from "./nav"
import { useRequestSignOut } from "./sign-out-dialog"
import { useWhatsAppAccess } from "./whatsapp-cta"

const NOTIFICATIONS = [
  { id: "bill", title: "Internet — Vivo Fibra venceu", detail: "R$ 119,90 · há 10 dias", href: "/dashboard/financas" },
  { id: "cards", title: "6 flashcards para revisar", detail: "Direito Constitucional e inglês", href: "/dashboard/estudos" },
  { id: "workout", title: "Treino A amanhã às 7h", detail: "Peito e tríceps", href: "/dashboard/treinos" },
]

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

// The unread flag is shared, so the phone's full header and its compact bar (both mounted) always show the same badge.
let unreadNotifications = true
const unreadListeners = new Set<() => void>()
function markNotificationsRead() {
  unreadNotifications = false
  unreadListeners.forEach((listener) => listener())
}
function subscribeUnread(listener: () => void) {
  unreadListeners.add(listener)
  return () => void unreadListeners.delete(listener)
}

/** `bare`: no border or fill of its own, for use inside a pill group (the collapsed header). */
export function Bell({ bare = false }: { bare?: boolean }) {
  const unread = useSyncExternalStore(subscribeUnread, () => unreadNotifications, () => true)
  return (
    <Popover onOpenChange={(open) => open && markNotificationsRead()}>
      <PopoverTrigger asChild>
        <Button variant={bare ? "ghost" : "surface"} size="icon" className={cn("relative rounded-full", bare && "size-10 md:size-10")} aria-label={unread ? "Notificações, há novas" : "Notificações"}>
          <BellIcon strokeWidth={1.75} />
          {unread ? <span aria-hidden className={cn("absolute top-2 right-2.5 size-2 rounded-full bg-highlight ring-2", bare ? "ring-card" : "ring-background")} /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-2">
        <p className="px-3 py-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Notificações</p>
        {NOTIFICATIONS.map((n) => (
          <Link key={n.id} href={n.href} className="flex flex-col rounded-xl px-3 py-2.5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="text-[15px] leading-5">{n.title}</span>
            <span className="text-[13px] leading-5 text-muted-foreground">{n.detail}</span>
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  )
}

const menuItem = "min-h-11 gap-3 rounded-xl px-3 py-2 text-[15px]"
const menuIcon = "size-[18px]"

/**
 * `header`: the collapsed layout's top header, which sits inside its own pill group and shows the name and e-mail from 1440 px.
 * `compact`: avatar only (mobile header); its menu also lists "Conectar WhatsApp", since there is no sidebar card on mobile.
 */
export function UserMenu({ user, compact = false, header = false }: { user: ShellUser; compact?: boolean; header?: boolean }) {
  const requestSignOut = useRequestSignOut()
  const { definition, pro } = usePlan()
  const whatsapp = useWhatsAppAccess()
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
        <div className="flex items-center justify-between gap-3 p-3 pt-0">
          <Badge className={cn("rounded-full", pro ? "bg-highlight text-highlight-foreground" : "bg-muted text-muted-foreground")}>{definition.name}</Badge>
          <DropdownMenuItem asChild className="size-8 justify-center rounded-full border border-border p-0">
            <Link href="/dashboard/plano" aria-label="Ver planos">
              <ChevronRightIcon strokeWidth={1.75} className="size-4" />
            </Link>
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="mx-1 my-2" />
        {ACCOUNT_ITEMS.map((item) => (
          <DropdownMenuItem key={item.id} asChild className={menuItem}>
            <Link href={item.href}>
              <item.icon strokeWidth={1.75} className={menuIcon} /> {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {compact && !(whatsapp.connected && !whatsapp.locked) ? (
          <DropdownMenuItem asChild className={menuItem}>
            <Link href={whatsapp.href}>
              <MessageCircleIcon strokeWidth={1.75} className={menuIcon} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                Conectar WhatsApp
                {whatsapp.locked ? <span className="text-[11px] text-muted-foreground">Plano Pro</span> : null}
              </span>
              {whatsapp.locked ? <SparklesIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" /> : null}
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
  const now = new Date(nowIso)
  const firstName = user.name.split(" ")[0]
  const meta = metaFor(pathname)
  const isToday = pathname === "/dashboard"
  const title = isToday ? `${greeting(now, MOCK_TIMEZONE)}, ${firstName}` : (meta?.title ?? "Organizzou")
  const subtitle = isToday
    ? format(inTz(now, MOCK_TIMEZONE), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())
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
