"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { EllipsisIcon, LayoutDashboardIcon, LogOutIcon, SquareKanbanIcon, WalletIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { AssistantProvider } from "@/components/assistant/assistant-context"
import { AssistantSheet } from "@/components/assistant/assistant-sheet"
import { QuickCapture } from "@/components/assistant/quick-capture"
import { AssistantFab } from "@/components/organizzou/AssistantFab"
import { BottomNav, type BottomNavItem } from "@/components/organizzou/BottomNav"
import { modules, type ModuleId } from "@/components/organizzou/modules"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { isMock } from "@/mocks/config"
import { getMockBoardsStore } from "@/mocks/tasks-api"
import { cn } from "@/lib/utils"

import { AppSidebar, isActivePath, type ShellUser } from "./app-sidebar"
import { ACCOUNT_GROUP_LABEL, ACCOUNT_ITEMS } from "./account-menu"
import { FrameGlass } from "./frame-glass"
import { AppTopBar, usePageHeading } from "./app-topbar"
import { AppTopHeader } from "./app-topheader"
import { SignOutDialog, SignOutProvider } from "./sign-out-dialog"
import { CommandPalette } from "./command-palette"
import { NAV_GROUPS } from "./nav"
import { PrimaryActionProvider } from "./primary-action"
import { WhatsAppCta } from "./whatsapp-cta"

const navItems: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem] = [
  { id: "/dashboard", label: "Hoje", icon: LayoutDashboardIcon },
  { id: "/dashboard/tarefas", label: "Tarefas", icon: SquareKanbanIcon },
  { id: "/dashboard/financas", label: "Finanças", icon: WalletIcon },
  { id: "mais", label: "Mais", icon: EllipsisIcon },
]

// The profile is the source of truth for the theme across devices.
function ThemeSync({ theme }: { theme?: string }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    if (theme === "dark" || theme === "light") setTheme(theme)
  }, [theme, setTheme])
  return null
}

function subscribeTablet(onChange: () => void) {
  const query = window.matchMedia("(max-width: 1023px)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** True below 1024 px: between 768 and 1023 px the sidebar starts as an icon rail. */
function useIsTablet() {
  return useSyncExternalStore(
    subscribeTablet,
    () => window.matchMedia("(max-width: 1023px)").matches,
    () => false
  )
}

/** Collapsed layout only: the page title and subtitle (moved out of the header) sit above the page content. */
function PageHeading({ user, nowIso }: { user: ShellUser; nowIso: string }) {
  const { title, subtitle } = usePageHeading(user, nowIso)
  return (
    <div className="hidden min-w-0 flex-col pt-6 pb-5 md:flex">
      <h1 className="truncate pb-0.5 text-[30px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="truncate text-[15px] leading-6 text-muted-foreground">{subtitle}</p>
    </div>
  )
}

type AppShellProps = {
  user: ShellUser
  /** Saved preference from the profile; undefined keeps whatever the browser has. */
  theme?: string
  /** Request time from the server, used by the prototype assistant to answer relative questions. */
  nowIso: string
  /** Stored sidebar choice (per user cookie). Null when the user never toggled it. */
  sidebarOpen: boolean | null
  sidebarCookie: string
  children: React.ReactNode
}

export function AppShell({ user, theme, nowIso, sidebarOpen, sidebarCookie, children }: AppShellProps) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [choice, setChoice] = useState<boolean | null>(sidebarOpen)
  const open = choice ?? !isTablet
  // Collapsed sidebar on desktop = rail + top header layout (the expanded sidebar keeps the classic layout).
  const topLayout = !open

  const activeId = navItems.find((item) => item.id !== "mais" && isActivePath(pathname, item.id))?.id ?? ""
  // Stable references, so the memoized sidebar and top bar skip re-renders caused by dialogs and sheets opening.
  const counts = useMemo<Partial<Record<ModuleId, number>>>(
    () => (isMock ? { tarefas: getMockBoardsStore(nowIso).boards.reduce((sum, b) => sum + b.tasks.filter((t) => !t.completed_at).length, 0) } : {}),
    [nowIso]
  )
  const openSearch = useCallback(() => {
    setSearchQuery("")
    setSearchOpen(true)
  }, [])
  const openSearchWith = useCallback((query: string) => {
    setSearchQuery(query)
    setSearchOpen(true)
  }, [])
  const onSearchOpenChange = useCallback((value: boolean) => {
    setSearchOpen(value)
    if (!value) setSearchQuery("")
  }, [])
  const requestSignOut = useCallback(() => setSignOutOpen(true), [])
  const assistantContext = useMemo(() => ({ openAssistant: () => setAssistantOpen(true), openQuickCapture: () => setCaptureOpen(true) }), [])

  function onSelect(id: string) {
    if (id === "mais") {
      setMoreOpen(true)
      return
    }
    router.push(id)
  }

  return (
    <AssistantProvider value={assistantContext}>
      <SignOutProvider value={requestSignOut}>
      <PrimaryActionProvider>
        {/* Layer 0 (the tiny pre-blurred photo) is rendered once by the (app) layout. Layer 1 (md+): the frame, fixed at 20px,
            with `contain: layout` so the sidebar and the floating buttons position against the frame. */}
        <SidebarProvider
          open={open}
          onOpenChange={setChoice}
          cookieName={sidebarCookie}
          className="md:glass-frame md:fixed md:inset-5 md:w-auto md:min-h-0 md:overflow-hidden md:rounded-[32px] md:contain-layout"
        >
          <ThemeSync theme={theme} />
          <FrameGlass />
          {topLayout ? <AppTopHeader user={user} onSearch={openSearchWith} /> : null}
          <AppSidebar counts={counts} />
          {/* Frame padding P = 16px, the same distance the sidebar keeps: the column (top bar + content) starts at the sidebar's
              top, ends at its bottom and keeps P from the right edge. */}
          <SidebarInset className={cn("min-w-0 bg-transparent md:min-h-0 md:overflow-hidden md:p-4 md:pl-0", topLayout && "md:pt-[4.5rem]")}>
            <AppTopBar user={user} nowIso={nowIso} onSearch={openSearch} onSearchWith={openSearchWith} hideDesktop={topLayout} />
            {/* The frame stays put; only this box scrolls (hidden scrollbar), clipped to the card radius. `@container` drives the
                bento reflow by the width that is really available next to the sidebar. */}
            <div data-app-scroll className="no-scrollbar flex-1 overscroll-contain md:min-h-0 md:overflow-y-auto md:rounded-[24px]">
              <div className="@container w-full px-4 pt-2 pb-28 md:px-0 md:pt-0 md:pb-0">
                {topLayout ? <PageHeading user={user} nowIso={nowIso} /> : null}
                {children}
              </div>
            </div>
          </SidebarInset>

          <AssistantFab className="fixed right-4 bottom-24 z-40 md:right-6 md:bottom-6" onClick={() => setAssistantOpen(true)} />

          <BottomNav
            items={navItems}
            activeId={activeId}
            onSelect={onSelect}
            onAdd={() => setCaptureOpen(true)}
            className="fixed inset-x-0 bottom-0 z-30 md:hidden"
          />

          <CommandPalette open={searchOpen} onOpenChange={onSearchOpenChange} initialQuery={searchQuery} onAskAssistant={() => setAssistantOpen(true)} nowIso={nowIso} />
          <AssistantSheet open={assistantOpen} onOpenChange={setAssistantOpen} isMobile={isMobile} nowIso={nowIso} />
          <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} />
          <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-[24px]">
              <SheetHeader>
                <SheetTitle>Todos os módulos</SheetTitle>
                <SheetDescription className="sr-only">Escolha um módulo para abrir.</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-5 px-4 pb-4" aria-label="Módulos">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-col">
                    <p className="pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{group.label}</p>
                    {group.items.map((id) => {
                      const m = modules[id]
                      return (
                        <Link
                          key={id}
                          href={m.href}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex min-h-12 items-center gap-4 rounded-full px-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            isActivePath(pathname, m.href) && "bg-highlight font-medium text-highlight-foreground"
                          )}
                        >
                          <m.icon aria-hidden strokeWidth={1.75} className="size-5" />
                          {m.name}
                        </Link>
                      )
                    })}
                  </div>
                ))}
                <div className="flex flex-col">
                  <p className="pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{ACCOUNT_GROUP_LABEL}</p>
                  {ACCOUNT_ITEMS.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center gap-4 rounded-full px-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        isActivePath(pathname, item.href) && "bg-highlight font-medium text-highlight-foreground"
                      )}
                    >
                      <item.icon aria-hidden strokeWidth={1.75} className="size-5" />
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false)
                      setSignOutOpen(true)
                    }}
                    className="flex min-h-12 items-center gap-4 rounded-full px-3 text-left text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <LogOutIcon aria-hidden strokeWidth={1.75} className="size-5" />
                    Sair
                  </button>
                </div>
                <WhatsAppCta onNavigate={() => setMoreOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
        </SidebarProvider>
      </PrimaryActionProvider>
      </SignOutProvider>
    </AssistantProvider>
  )
}
