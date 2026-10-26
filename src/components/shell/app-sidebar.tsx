"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react"

import { Logo } from "@/components/organizzou/Logo"
import { moduleList } from "@/components/organizzou/modules"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { signOut } from "@/features/auth/actions"
import { cn } from "@/lib/utils"

export type ShellUser = { name: string; email: string }

const activeClass = "data-active:bg-highlight data-active:text-highlight-foreground"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4">
        <Link href="/hoje" aria-label="Organizzou" className="group-data-[collapsible=icon]:hidden">
          <Logo className="h-8" />
        </Link>
        <Link href="/hoje" aria-label="Organizzou" className="hidden group-data-[collapsible=icon]:block">
          <Logo iconOnly className="size-8" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {moduleList.map((m) => (
                <SidebarMenuItem key={m.id}>
                  <SidebarMenuButton
                    asChild
                    size="lg"
                    tooltip={m.name}
                    isActive={isActivePath(pathname, m.href)}
                    className={cn("rounded-full", activeClass)}
                  >
                    <Link href={m.href}>
                      <m.icon strokeWidth={1.75} />
                      <span>{m.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="rounded-full">
              <Avatar className="size-8">
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <ChevronsUpDownIcon strokeWidth={1.75} className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">
                <SettingsIcon strokeWidth={1.75} /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOutIcon strokeWidth={1.75} /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
