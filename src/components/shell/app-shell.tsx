"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { EllipsisIcon, LayoutDashboardIcon, SearchIcon, SettingsIcon, SquareKanbanIcon, WalletIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { AssistantFab } from "@/components/organizzou/AssistantFab"
import { BottomNav, type BottomNavItem } from "@/components/organizzou/BottomNav"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { moduleList } from "@/components/organizzou/modules"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

import { AppSidebar, isActivePath, type ShellUser } from "./app-sidebar"
import { CommandPalette } from "./command-palette"

const navItems: [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem] = [
  { id: "/hoje", label: "Hoje", icon: LayoutDashboardIcon },
  { id: "/tarefas", label: "Tarefas", icon: SquareKanbanIcon },
  { id: "/financas", label: "Finanças", icon: WalletIcon },
  { id: "mais", label: "Mais", icon: EllipsisIcon },
]

// The profile is the source of truth for the theme across devices.
function ThemeSync({ theme }: { theme: string }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    if (theme === "dark" || theme === "light") setTheme(theme)
  }, [theme, setTheme])
  return null
}

type AppShellProps = {
  user: ShellUser
  theme: string
  children: React.ReactNode
}

export function AppShell({ user, theme, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const activeId = navItems.find((item) => item.id !== "mais" && isActivePath(pathname, item.id))?.id ?? ""

  function onSelect(id: string) {
    if (id === "mais") {
      setMoreOpen(true)
      return
    }
    router.push(id)
  }

  return (
    <SidebarProvider>
      <ThemeSync theme={theme} />
      <div className="hidden md:contents">
        <AppSidebar user={user} />
      </div>
      <SidebarInset className="min-w-0">
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:px-6">
          <SidebarTrigger className="hidden md:inline-flex" />
          <Button
            variant="ghost"
            className="ml-auto gap-2 text-muted-foreground md:min-w-56 md:justify-start"
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar"
          >
            <SearchIcon strokeWidth={1.75} />
            <span className="hidden md:inline">Buscar…</span>
            <kbd className="ml-auto hidden rounded-md border border-border px-1.5 text-[11px] leading-5 md:inline">
              Ctrl K
            </kbd>
          </Button>
          <ThemeToggle />
        </header>
        <div className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-6 pb-28 md:px-6 md:pb-10 lg:px-10">
          {children}
        </div>
      </SidebarInset>

      <AssistantFab
        className="fixed right-4 bottom-24 z-40 md:right-6 md:bottom-6"
        onClick={() => toast("O assistente chega em breve.")}
      />

      <BottomNav
        items={navItems}
        activeId={activeId}
        onSelect={onSelect}
        onAdd={() => toast("A captura rápida chega em breve.")}
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
      />

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-[20px]">
          <SheetHeader>
            <SheetTitle>Todos os módulos</SheetTitle>
            <SheetDescription className="sr-only">Escolha um módulo para abrir.</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col px-4 pb-6">
            {[...moduleList, { id: "config", name: "Configurações", href: "/configuracoes", icon: SettingsIcon }].map(
              (m) => (
                <Link
                  key={m.id}
                  href={m.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-12 items-center gap-4 border-b border-border py-2 text-[15px] last:border-b-0"
                >
                  <m.icon aria-hidden strokeWidth={1.75} className="size-5 text-muted-foreground" />
                  {m.name}
                </Link>
              )
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  )
}
