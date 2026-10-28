"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarDaysIcon, EllipsisIcon, LayoutDashboardIcon, SquareKanbanIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { AssistantProvider } from "@/components/assistant/assistant-context"
import { AssistantSheet } from "@/components/assistant/assistant-sheet"
import { QuickCapture } from "@/components/assistant/quick-capture"
import { AssistantFab } from "@/components/organizzou/AssistantFab"
import { BottomNav, type BottomNavItem } from "@/components/organizzou/BottomNav"
import { modules, type ModuleId } from "@/components/organizzou/modules"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTextEntryFocused } from "@/hooks/use-text-entry-focused"
import { isMock } from "@/mocks/config"
import { getMockBoardsStore } from "@/mocks/tasks-api"
import { cn } from "@/lib/utils"

import { PlanProvider } from "@/components/organizzou/plan-context"
import { ACCOUNT_ITEMS } from "./account-menu"
import type { PlanId } from "@/lib/plans"
import { AppSidebar, isActivePath, type ShellUser } from "./app-sidebar"
import { FrameGlass } from "./frame-glass"
import { AppTopBar, usePageHeading } from "./app-topbar"
import { AppTopHeader } from "./app-topheader"
import { SignOutDialog, SignOutProvider } from "./sign-out-dialog"
import { CommandPalette } from "./command-palette"
import { MobileHeader } from "./mobile-header"
import { OthersDrawer, isOtherPath } from "./others-drawer"
import { PrimaryActionProvider } from "./primary-action"

const OTHERS_ID = "outros"

// "Outros" opens a drawer with the remaining modules (Finanças, Vida, Organização); the header chips reach them too.
const navItems: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem] = [
  { id: "/dashboard", label: "Hoje", icon: LayoutDashboardIcon },
  { id: "/dashboard/tarefas", label: "Tarefas", icon: SquareKanbanIcon },
  { id: "/dashboard/agenda", label: "Agenda", icon: CalendarDaysIcon },
  { id: OTHERS_ID, label: "Outros", icon: EllipsisIcon },
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

type ShellBottomBarProps = { activeId: string; onSelect: (id: string) => void; onAssistant: () => void }

/**
 * Phones: one fixed row 12 px above the bottom safe area, 16 px from both edges. `--bottom-bar-h` (52 px) is the height of both the nav and the assistant button. The floating nav takes the remaining width and the
 * assistant button (a Lima circle, no glass) sits at its right, vertically centered. The row hides while the keyboard is open.
 */
function ShellBottomBar({ activeId, onSelect, onAssistant }: ShellBottomBarProps) {
  const typing = useTextEntryFocused()
  return (
    <div className={cn("fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 flex items-center gap-3 [--bottom-bar-h:52px] md:hidden", typing && "hidden")}>
      <BottomNav items={navItems} activeId={activeId} onSelect={onSelect} className="flex-1" />
      <AssistantFab className="size-(--bottom-bar-h) shrink-0 bg-highlight text-highlight-foreground [&_svg]:size-5" onClick={onAssistant} />
    </div>
  )
}

/** Mobile and collapsed layout: the page title and subtitle (not part of the header) sit above the page content. */
function PageHeading({ user, nowIso }: { user: ShellUser; nowIso: string }) {
  const { title, subtitle } = usePageHeading(user, nowIso)
  return (
    <div className="flex min-w-0 flex-col pt-4 pb-4 md:pt-6 md:pb-5">
      <h1 className="truncate pb-0.5 text-[26px] leading-tight font-semibold tracking-[-0.02em] md:text-[30px]">{title}</h1>
      <p className="truncate text-[15px] leading-6 text-muted-foreground">{subtitle}</p>
    </div>
  )
}

type AppShellProps = {
  user: ShellUser
  /** Saved preference from the profile; undefined keeps whatever the browser has. */
  theme?: string
  /** The user's plan (profiles.plan, defaults to free). */
  plan: PlanId
  /** Request time from the server, used by the prototype assistant to answer relative questions. */
  nowIso: string
  /** Stored sidebar choice (per user cookie). Null when the user never toggled it. */
  sidebarOpen: boolean | null
  sidebarCookie: string
  children: React.ReactNode
}

export function AppShell({ user, theme, plan, nowIso, sidebarOpen, sidebarCookie, children }: AppShellProps) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [othersOpen, setOthersOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [choice, setChoice] = useState<boolean | null>(sidebarOpen)
  const open = choice ?? !isTablet
  // Collapsed sidebar on desktop = rail + top header layout (the expanded sidebar keeps the classic layout).
  const topLayout = !open

  const activeId = navItems.find((item) => item.id !== OTHERS_ID && isActivePath(pathname, item.id))?.id ?? (isOtherPath(pathname) ? OTHERS_ID : "")
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
  // Warm every module route while the browser is idle (production only; in dev Next does not prefetch), so opening a module
  // streams its skeleton from the cache instead of waiting for the server.
  useEffect(() => {
    const hrefs = [...Object.values(modules).map((m) => m.href), ...ACCOUNT_ITEMS.map((i) => i.href), "/dashboard/plano"]
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
    const handle = idle(() => hrefs.forEach((href) => router.prefetch(href)))
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle as number)
      else window.clearTimeout(handle as number)
    }
  }, [router])
  const requestSignOut = useCallback(() => setSignOutOpen(true), [])
  const assistantContext = useMemo(() => ({ openAssistant: () => setAssistantOpen(true), openQuickCapture: () => setCaptureOpen(true) }), [])

  function onSelect(id: string) {
    if (id === OTHERS_ID) setOthersOpen(true)
    else router.push(id)
  }

  return (
    <AssistantProvider value={assistantContext}>
      <PlanProvider plan={plan}>
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
            <MobileHeader user={user} onSearch={openSearch} />
            <AppTopBar user={user} nowIso={nowIso} onSearchWith={openSearchWith} hideDesktop={topLayout} />
            {/* The frame stays put; only this box scrolls (hidden scrollbar), clipped to the card radius. `@container` drives the
                bento reflow by the width that is really available next to the sidebar. */}
            <div data-app-scroll className="no-scrollbar flex-1 overscroll-contain md:min-h-0 md:overflow-y-auto md:rounded-[24px]">
              <div className="@container w-full px-4 pt-0 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:px-0 md:pt-0 md:pb-0">
                {topLayout || isMobile ? <PageHeading user={user} nowIso={nowIso} /> : null}
                {children}
              </div>
            </div>
          </SidebarInset>

          {/* Desktop keeps the corner button; phones have it in the bottom bar. */}
          <AssistantFab className="fixed z-40 max-md:hidden md:right-6 md:bottom-6" onClick={() => setAssistantOpen(true)} />

          <ShellBottomBar activeId={activeId} onSelect={onSelect} onAssistant={() => setAssistantOpen(true)} />

          <CommandPalette open={searchOpen} onOpenChange={onSearchOpenChange} initialQuery={searchQuery} onAskAssistant={() => setAssistantOpen(true)} nowIso={nowIso} />
          <AssistantSheet open={assistantOpen} onOpenChange={setAssistantOpen} isMobile={isMobile} nowIso={nowIso} />
          <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} />
          <OthersDrawer open={othersOpen} onOpenChange={setOthersOpen} />
          <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
        </SidebarProvider>
      </PrimaryActionProvider>
      </SignOutProvider>
      </PlanProvider>
    </AssistantProvider>
  )
}
