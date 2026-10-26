"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CircleHelpIcon, LogOutIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SettingsIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-context"
import { Logo } from "@/components/organizzou/Logo"
import { modules, type ModuleId } from "@/components/organizzou/modules"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { signOut } from "@/features/auth/actions"
import { cn } from "@/lib/utils"

import { NAV_GROUPS } from "./nav"
import { WhatsAppCta } from "./whatsapp-cta"

export type ShellUser = { name: string; email: string }

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Active item: Lima pill with Tinta icon and text. Hover: Papel 6%.
const itemClass =
  "h-11 rounded-full px-4 text-[15px] hover:bg-sidebar-accent data-active:bg-highlight data-active:font-medium data-active:text-highlight-foreground data-active:hover:bg-highlight group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"

type AppSidebarProps = { counts: Partial<Record<ModuleId, number>> }

export function AppSidebar({ counts }: AppSidebarProps) {
  const pathname = usePathname()
  const { state, toggleSidebar } = useSidebar()
  const { openAssistant } = useAssistant()
  const collapsed = state === "collapsed"

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className={cn("gap-3 px-5 pt-5 pb-1", collapsed && "items-center px-0")}>
        <div className={cn("flex items-center justify-between gap-2", collapsed && "flex-col")}>
          <Link href="/hoje" aria-label="Organizzou — Hoje" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50">
            {collapsed ? <Logo iconOnly className="size-10" /> : <Logo tone="on-dark" className="h-8" />}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sidebar-foreground/70 outline-none transition-colors duration-120 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"
          >
            {collapsed ? <PanelLeftOpenIcon strokeWidth={1.75} className="size-5" /> : <PanelLeftCloseIcon strokeWidth={1.75} className="size-5" />}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-3">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="px-0 py-1">
            <SidebarGroupLabel className="px-4 text-[11px] leading-4 font-semibold tracking-[0.12em] text-sidebar-foreground/60 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((id) => {
                  const m = modules[id]
                  const count = counts[id]
                  return (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton asChild tooltip={m.name} isActive={isActivePath(pathname, m.href)} className={itemClass}>
                        <Link href={m.href}>
                          <m.icon strokeWidth={1.75} className="size-5!" />
                          <span className="group-data-[collapsible=icon]:sr-only">{m.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count ? (
                        <SidebarMenuBadge className="tabular right-3 h-6 min-w-6 rounded-full bg-sidebar-accent px-2 text-[12px] text-sidebar-foreground peer-data-active/menu-button:bg-highlight-foreground/10 peer-data-active/menu-button:text-highlight-foreground">
                          {count}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <div className="mt-auto px-0 pt-2 pb-2 group-data-[collapsible=icon]:hidden">
          <WhatsAppCta />
        </div>
      </SidebarContent>

      <SidebarFooter className="gap-0 px-3 pb-4">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações" isActive={isActivePath(pathname, "/configuracoes")} className={itemClass}>
              <Link href="/configuracoes">
                <SettingsIcon strokeWidth={1.75} className="size-5!" />
                <span className="group-data-[collapsible=icon]:sr-only">Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Ajuda" className={itemClass} onClick={openAssistant}>
              <CircleHelpIcon strokeWidth={1.75} className="size-5!" />
              <span className="group-data-[collapsible=icon]:sr-only">Ajuda</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" className={itemClass} onClick={() => void signOut()}>
              <LogOutIcon strokeWidth={1.75} className="size-5!" />
              <span className="group-data-[collapsible=icon]:sr-only">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
