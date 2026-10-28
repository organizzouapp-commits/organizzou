"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { modules, type ModuleId } from "@/components/organizzou/modules"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

import { isActivePath } from "./app-sidebar"
import { NAV_GROUPS } from "./nav"

/** Modules that already have a slot in the floating nav; the drawer lists all the others. */
const IN_NAV: ModuleId[] = ["hoje", "tarefas", "agenda"]

const [MAIN_GROUP, ...FOLDED_GROUPS] = NAV_GROUPS
/** Finanças has no heading of its own (it is the only leftover of the main group), Vida and Organização keep theirs. */
const SECTIONS: { label?: string; items: ModuleId[] }[] = [
  { items: MAIN_GROUP.items.filter((id) => !IN_NAV.includes(id)) },
  ...FOLDED_GROUPS,
]

/** True when the route belongs to a module that is only reachable from "Outros". */
export function isOtherPath(pathname: string) {
  return SECTIONS.some((section) => section.items.some((id) => isActivePath(pathname, modules[id].href)))
}

/** Bottom sheet behind the "Outros" item of the floating nav: the remaining modules, grouped like the desktop sidebar. */
export function OthersDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[24px] data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>Outros módulos</DrawerTitle>
          <DrawerDescription className="sr-only">Escolha um módulo para abrir.</DrawerDescription>
        </DrawerHeader>
        <nav aria-label="Outros módulos" className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {SECTIONS.map((section, index) => (
            <div key={section.label ?? index} className="flex flex-col">
              {section.label ? <p className="px-3 pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{section.label}</p> : null}
              {section.items.map((id) => {
                const m = modules[id]
                const active = isActivePath(pathname, m.href)
                return (
                  <Link
                    key={id}
                    href={m.href}
                    onClick={() => onOpenChange(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-4 rounded-full px-3 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active && "bg-highlight font-medium text-highlight-foreground"
                    )}
                  >
                    <m.icon aria-hidden strokeWidth={1.75} className="size-5" />
                    {m.name}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  )
}
