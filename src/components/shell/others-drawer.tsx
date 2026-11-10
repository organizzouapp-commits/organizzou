"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOutIcon } from "lucide-react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

import { isActivePath, useNav, type NavConfig } from "./nav-config"
import { SidebarCta } from "./plan-cta"
import { useRequestSignOut } from "./sign-out-dialog"

/** True when the route belongs to a page that is only reachable from the "more" sheet ("Outros" in the app, "Mais" in the admin). */
export function isOtherPath(nav: NavConfig, pathname: string) {
  return nav.mobile.more.sections.some((section) => section.items.some((item) => isActivePath(pathname, item.href)))
}

/** Bottom sheet behind the last item of the floating nav: the pages that have no slot in it, grouped like the desktop sidebar. */
export function OthersDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname()
  const nav = useNav()
  const { more } = nav.mobile
  const requestSignOut = useRequestSignOut()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[24px] data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{more.title}</DrawerTitle>
          <DrawerDescription className="sr-only">Escolha uma página para abrir.</DrawerDescription>
        </DrawerHeader>
        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Same slot as the sidebar card: the upgrade card for Free users (the assistant is in the quick-actions button). */}
          {nav.features.plan ? <SidebarCta onNavigate={() => onOpenChange(false)} className="[&]:min-h-14" /> : null}
        <nav aria-label={more.title} className="flex flex-col gap-4">
          {more.sections.map((section, index) => (
            <div key={section.label ?? index} className="flex flex-col">
              {section.label ? <p className="px-3 pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{section.label}</p> : null}
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href)
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-4 rounded-full px-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active && "bg-highlight font-medium text-highlight-foreground"
                    )}
                  >
                    <item.icon aria-hidden strokeWidth={1.75} className="size-5" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
          {nav.account ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                requestSignOut()
              }}
              className="flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <LogOutIcon aria-hidden strokeWidth={1.75} className="size-5" />
              Sair
            </button>
          ) : null}
        </nav>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
