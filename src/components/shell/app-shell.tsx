"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { EllipsisIcon, LayoutDashboardIcon, SettingsIcon, SquareKanbanIcon, WalletIcon } from "lucide-react"
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

import { AppBackground } from "./app-background"
import { AppSidebar, isActivePath, type ShellUser } from "./app-sidebar"
import { AppTopBar } from "./app-topbar"
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
  const [moreOpen, setMoreOpen] = useState(false)
  const [choice, setChoice] = useState<boolean | null>(sidebarOpen)
  const open = choice ?? !isTablet

  const activeId = navItems.find((item) => item.id !== "mais" && isActivePath(pathname, item.id))?.id ?? ""
  const counts: Partial<Record<ModuleId, number>> = isMock
    ? { tarefas: getMockBoardsStore(nowIso).boards.reduce((sum, b) => sum + b.tasks.filter((t) => !t.completed_at).length, 0) }
    : {}

  function onSelect(id: string) {
    if (id === "mais") {
      setMoreOpen(true)
      return
    }
    router.push(id)
  }

  return (
    <AssistantProvider value={{ openAssistant: () => setAssistantOpen(true), openQuickCapture: () => setCaptureOpen(true) }}>
      <PrimaryActionProvider>
        {/* Layer 0: pre-blurred photo + tint. Layer 1 (md+): the frosted frame, fixed at 20px, with `contain: layout` so the
            sidebar and the floating buttons position against the frame even without backdrop-filter. */}
        <AppBackground />
        <SidebarProvider
          open={open}
          onOpenChange={setChoice}
          cookieName={sidebarCookie}
          className="md:glass-frame md:fixed md:inset-5 md:w-auto md:min-h-0 md:overflow-hidden md:rounded-[32px] md:contain-layout"
        >
          <ThemeSync theme={theme} />
          <AppSidebar counts={counts} />
          <SidebarInset className="min-w-0 bg-transparent md:min-h-0 md:overflow-hidden">
            <AppTopBar user={user} nowIso={nowIso} onSearch={() => setSearchOpen(true)} />
            {/* Desktop/tablet: the frame stays put and the content scrolls inside it. */}
            <div className="flex-1 md:min-h-0 md:overflow-y-auto">
              <div className="mx-auto w-full max-w-[1440px] px-4 pt-2 pb-28 md:px-6 md:pb-10">{children}</div>
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

          <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} onAskAssistant={() => setAssistantOpen(true)} nowIso={nowIso} />
          <AssistantSheet open={assistantOpen} onOpenChange={setAssistantOpen} isMobile={isMobile} nowIso={nowIso} />
          <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} />

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
                <Link
                  href="/dashboard/configuracoes"
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-12 items-center gap-4 rounded-full px-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <SettingsIcon aria-hidden strokeWidth={1.75} className="size-5" />
                  Configurações
                </Link>
                <WhatsAppCta onNavigate={() => setMoreOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
        </SidebarProvider>
      </PrimaryActionProvider>
    </AssistantProvider>
  )
}
