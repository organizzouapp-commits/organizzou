"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { EllipsisIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { AssistantProvider } from "@/components/assistant/assistant-context"
import { AssistantSheet } from "@/components/assistant/assistant-sheet"
import { QuickCapture } from "@/components/assistant/quick-capture"
import { BottomNav, type BottomNavItem } from "@/components/organizzou/BottomNav"
import { splashLog } from "@/components/organizzou/splash/splash-debug"
import { splash } from "@/components/organizzou/splash/splash-store"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTextEntryFocused } from "@/hooks/use-text-entry-focused"
import { cn } from "@/lib/utils"

import { PlanProvider } from "@/components/organizzou/plan-context"
import { AssistantFloatingButton } from "./assistant-card"
import { isPro, type PlanId } from "@/lib/plans"
import { AdminCommandPalette } from "@/components/admin/admin-command-palette"
import { AppSidebar, type ShellUser } from "./app-sidebar"
import { FrameGlass } from "./frame-glass"
import { isActivePath, MORE_ID, NavProvider, type NavConfig } from "./nav-config"
import { NAVS } from "./nav-registry"
import { AppTopBar, usePageHeading } from "./app-topbar"
import { AppTopHeader } from "./app-topheader"
import { SignOutDialog, SignOutProvider } from "./sign-out-dialog"
import { CommandPalette } from "./command-palette"
import { MobileHeader } from "./mobile-header"
import { OthersDrawer, isOtherPath } from "./others-drawer"
import { PrimaryActionProvider } from "./primary-action"
import { NotificationsProvider } from "./notifications"
import type { AppNotification } from "@/features/notifications/types"

// The last slot ("Outros" in the app, "Mais" in the admin) opens a drawer with the remaining pages; the header chips reach them too.
function bottomNavItems(nav: NavConfig): BottomNavItem[] {
  return [...nav.mobile.pill.map((item) => ({ id: item.href, label: item.label, icon: item.icon })), { id: MORE_ID, label: nav.mobile.more.label, icon: EllipsisIcon }]
}

/**
 * The profile carries the theme across devices: when the app opens, a theme saved on the profile that differs from this device's is
 * applied ONCE. It must not re-apply on later renders: the person's own click (header switch or Perfil) changes the theme here and is
 * saved to the profile by useThemeChoice, and a stale profile value forcing itself back was exactly the "it won't go light" bug.
 * "Sistema" is a choice made on this device only (the profile column stores light or dark), so it is left alone.
 */
function ThemeSync({ theme }: { theme?: string }) {
  const { setTheme } = useTheme()
  const applied = useRef(false)
  useEffect(() => {
    if (applied.current) return
    applied.current = true
    let local: string | null = null
    try {
      local = window.localStorage.getItem("theme")
    } catch {
      // Blocked storage: the profile value is all there is.
    }
    if (local === "system") return
    if ((theme === "dark" || theme === "light") && theme !== local) setTheme(theme)
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

type ShellBottomBarProps = { items: BottomNavItem[]; activeId: string; onSelect: (id: string) => void; onAssistant: (() => void) | null }

/**
 * Phones: one fixed row 16 px above the bottom safe area and 16 px from both edges. The floating nav takes the width that is left and
 * the assistant button (Pro only, hidden while the assistant is open) sits at its right. The row hides while the keyboard is open.
 */
function ShellBottomBar({ items, activeId, onSelect, onAssistant }: ShellBottomBarProps) {
  const typing = useTextEntryFocused()
  return (
    <div className={cn("fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 flex items-center gap-3 md:hidden", typing && "hidden")}>
      <BottomNav items={items} activeId={activeId} onSelect={onSelect} className="flex-1" />
      {onAssistant ? <AssistantFloatingButton onClick={onAssistant} /> : null}
    </div>
  )
}

/** Mobile and collapsed layout: the page title and subtitle (not part of the header) sit above the page content. */
function PageHeading({ user, nowIso }: { user: ShellUser; nowIso: string }) {
  const { title, subtitle } = usePageHeading(user, nowIso)
  // On phones the Tarefas and Finanças titles live in their header card (in the page), so the shell heading steps aside there. Rotina, Treinos, Dieta, Estudos and Notas do the same.
  const pathname = usePathname()
  const ownsTitle = ["tarefas", "financas", "rotina", "treinos", "dieta", "estudos", "notas"].some((screen) => pathname.startsWith(`/dashboard/${screen}`))
  return (
    <div className={cn("flex min-w-0 flex-col pt-4 pb-4 md:pt-6 md:pb-5", ownsTitle && "max-md:hidden")}>
      <h1 className="truncate pb-0.5 text-[26px] leading-tight font-semibold tracking-[-0.02em] md:text-[30px]">{title}</h1>
      <p className="truncate text-[15px] leading-6 text-muted-foreground max-md:hidden">{subtitle}</p>
    </div>
  )
}

type AppShellProps = {
  /** Which navigation the shell renders: the app (/dashboard) or the admin area (/admin). */
  nav: NavConfig["id"]
  /** Signed-in user has app_metadata.role = admin: the avatar menu offers "Área do admin". */
  isAdmin?: boolean
  user: ShellUser
  /** Saved preference from the profile; undefined keeps whatever the browser has. */
  theme?: string
  /** The user's plan (profiles.plan, defaults to free). */
  plan: PlanId
  /** Request time from the server, used by the prototype assistant to answer relative questions. */
  nowIso: string
  /** Tasks not done yet, for the sidebar badge (real accounts). */
  openTasks?: number
  /** The latest notifications of the person, for the bell. */
  notifications?: AppNotification[]
  /** Stored sidebar choice (per user cookie). Null when the user never toggled it. */
  sidebarOpen: boolean | null
  sidebarCookie: string
  children: React.ReactNode
}

export function AppShell({ nav: navId, isAdmin = false, user, theme, plan, nowIso, sidebarOpen, sidebarCookie, openTasks = 0, notifications = [], children }: AppShellProps) {
  const nav = NAVS[navId]
  const bottomItems = useMemo(() => bottomNavItems(nav), [nav])
  const navValue = useMemo(() => ({ nav, isAdmin }), [nav, isAdmin])
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [othersOpen, setOthersOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  // The post-login splash leaves when the shell is here: the one explicit signal (see splash/splash-store.ts).
  useEffect(() => {
    splashLog("shell-mounted", { path: window.location.pathname })
    splash.markReady()
    return () => splash.markShellGone()
  }, [])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [choice, setChoice] = useState<boolean | null>(sidebarOpen)
  const open = choice ?? !isTablet
  // Collapsed sidebar on desktop = rail + top header layout (the expanded sidebar keeps the classic layout).
  const topLayout = !open

  const activeId = bottomItems.find((item) => item.id !== MORE_ID && isActivePath(pathname, item.id))?.id ?? (isOtherPath(nav, pathname) ? MORE_ID : "")
  // Stable references, so the memoized sidebar and top bar skip re-renders caused by dialogs and sheets opening.
  const counts = useMemo<Partial<Record<string, number>>>(
    () => {
      if (nav.id !== "app") return {}
      return openTasks > 0 ? { tarefas: openTasks } : {}
    },
    [nav, openTasks]
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
    const hrefs = [...nav.groups.flatMap((g) => g.items.map((i) => i.href)), ...(nav.account?.items.map((i) => i.href) ?? []), ...(nav.features.plan ? ["/dashboard/plano"] : [])]
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
    const handle = idle(() => hrefs.forEach((href) => router.prefetch(href)))
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle as number)
      else window.clearTimeout(handle as number)
    }
  }, [router, nav])
  const requestSignOut = useCallback(() => setSignOutOpen(true), [])
  // The virtual assistant is a Pro feature: Free users who reach it (a link, the palette) land on the plans page instead.
  const pro = isPro(plan)
  const openAssistant = useCallback(() => (pro ? setAssistantOpen(true) : router.push("/dashboard/plano")), [pro, router])
  const assistantContext = useMemo(() => ({ openAssistant, openQuickCapture: () => setCaptureOpen(true) }), [openAssistant])

  const withAssistant = nav.features.assistant

  function onSelect(id: string) {
    if (id === MORE_ID) setOthersOpen(true)
    else router.push(id)
  }

  return (
    <NotificationsProvider initial={notifications}>
    <NavProvider value={navValue}>
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
              <div className="@container w-full px-4 pt-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:px-0 md:pt-0 md:pb-0">
                {topLayout || isMobile ? <PageHeading user={user} nowIso={nowIso} /> : null}
                {children}
              </div>
            </div>
          </SidebarInset>

          <ShellBottomBar items={bottomItems} activeId={activeId} onSelect={onSelect} onAssistant={withAssistant && pro && !assistantOpen ? openAssistant : null} />

          {withAssistant ? (
            <>
              <CommandPalette open={searchOpen} onOpenChange={onSearchOpenChange} initialQuery={searchQuery} onAskAssistant={openAssistant} nowIso={nowIso} />
              {pro ? <AssistantSheet open={assistantOpen} onOpenChange={setAssistantOpen} isMobile={isMobile} nowIso={nowIso} /> : null}
              <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} />
            </>
          ) : (
            <AdminCommandPalette open={searchOpen} onOpenChange={onSearchOpenChange} initialQuery={searchQuery} />
          )}
          <OthersDrawer open={othersOpen} onOpenChange={setOthersOpen} />
          <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
        </SidebarProvider>
      </PrimaryActionProvider>
      </SignOutProvider>
      </PlanProvider>
    </AssistantProvider>
    </NavProvider>
    </NotificationsProvider>
  )
}
