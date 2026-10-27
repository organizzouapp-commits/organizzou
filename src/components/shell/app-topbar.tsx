"use client"

import { memo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BellIcon, ChevronDownIcon, LogOutIcon, PlusIcon, SearchIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
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
import { MOCK_TIMEZONE } from "@/mocks/time"

import type { ShellUser } from "./app-sidebar"
import { ACCOUNT_ITEMS } from "./account-menu"
import { metaFor } from "./nav"
import { useRequestSignOut } from "./sign-out-dialog"
import { usePrimaryActionValue } from "./primary-action"

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
  onSearch: () => void
}

function Bell() {
  const [unread, setUnread] = useState(true)
  return (
    <Popover onOpenChange={(open) => open && setUnread(false)}>
      <PopoverTrigger asChild>
        <Button variant="surface" size="icon" className="relative rounded-full" aria-label={unread ? "Notificações, há novas" : "Notificações"}>
          <BellIcon strokeWidth={1.75} />
          {unread ? <span aria-hidden className="absolute top-2 right-2.5 size-2 rounded-full bg-highlight ring-2 ring-background" /> : null}
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

function UserMenu({ user, compact = false }: { user: ShellUser; compact?: boolean }) {
  const requestSignOut = useRequestSignOut()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu da conta"
          className="flex min-w-0 items-center gap-3 rounded-full p-1 text-left outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 md:pr-3"
        >
          <Avatar className="size-10 shrink-0">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          {compact ? null : (
            <span className="hidden min-w-0 items-center gap-2 2xl:flex">
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="max-w-40 truncate text-[15px] font-medium">{user.name}</span>
                <span className="max-w-40 truncate text-[13px] text-muted-foreground">{user.email}</span>
              </span>
              <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-auto max-w-[calc(100vw-2rem)] min-w-60 rounded-2xl p-2">
        <DropdownMenuLabel className="flex min-w-0 flex-col px-3 py-3 leading-tight">
          <span className="truncate text-[15px] font-medium text-foreground">{user.name}</span>
          <span className="truncate text-[13px] font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-1 my-2" />
        {ACCOUNT_ITEMS.map((item) => (
          <DropdownMenuItem key={item.id} asChild className={menuItem}>
            <Link href={item.href}>
              <item.icon strokeWidth={1.75} className={menuIcon} /> {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="mx-1 my-2" />
        <DropdownMenuItem onSelect={requestSignOut} className={menuItem}>
          <LogOutIcon strokeWidth={1.75} className={menuIcon} /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const AppTopBar = memo(function AppTopBar({ user, nowIso, onSearch }: AppTopBarProps) {
  const pathname = usePathname()
  const { openQuickCapture } = useAssistant()
  const primary = usePrimaryActionValue()
  const now = new Date(nowIso)
  const firstName = user.name.split(" ")[0]
  const meta = metaFor(pathname)
  const isToday = pathname === "/dashboard"
  const title = isToday ? `${greeting(now, MOCK_TIMEZONE)}, ${firstName}` : (meta?.title ?? "Organizzou")
  const subtitle = isToday
    ? format(inTz(now, MOCK_TIMEZONE), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())
    : (meta?.subtitle ?? "")

  return (
    <>
      {/* Desktop and tablet */}
      <header className="hidden shrink-0 items-start justify-between gap-6 pb-4 md:flex md:min-h-[76px]">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-[28px] leading-9 font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="truncate text-[15px] leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSearch}
            aria-label="Buscar"
            className="hidden h-11 w-64 items-center gap-3 rounded-full border border-border bg-card px-4 text-left text-[15px] text-muted-foreground outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 2xl:flex"
          >
            <SearchIcon aria-hidden strokeWidth={1.75} className="size-4" />
            <span className="flex-1">Buscar…</span>
            <kbd className="rounded-md border border-border px-1.5 text-[11px] leading-5">Ctrl K</kbd>
          </button>
          <Button variant="surface" size="icon" className="rounded-full 2xl:hidden" aria-label="Buscar" onClick={onSearch}>
            <SearchIcon strokeWidth={1.75} />
          </Button>
          <Bell />
          <ThemeToggle round surface />
          <UserMenu user={user} />
          <Button size="lg" className="h-11 rounded-full px-5 md:h-11" onClick={primary?.onClick ?? openQuickCapture}>
            <PlusIcon strokeWidth={1.75} /> {primary?.label ?? "Novo"}
          </Button>
        </div>
      </header>

      {/* Mobile */}
      <header className="sticky top-0 z-20 border-b border-border bg-card flex min-h-16 items-center justify-between gap-3 px-4 py-2 md:hidden">
        <UserMenu user={user} compact />
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] leading-6 font-semibold">{isToday ? "Hoje" : title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="surface" size="icon" className="rounded-full" aria-label="Buscar" onClick={onSearch}>
            <SearchIcon strokeWidth={1.75} />
          </Button>
          <Bell />
        </div>
      </header>
    </>
  )
})
