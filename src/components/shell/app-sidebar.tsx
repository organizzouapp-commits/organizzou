"use client"

import { memo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, FolderIcon, LogOutIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, BadgeDollarSignIcon, UserIcon } from "lucide-react"

import { Logo } from "@/components/organizzou/Logo"
import { usePlan } from "@/components/organizzou/plan-context"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sidebar, SidebarRail, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { BackToAppButton, BackToAppRail, NavBrand } from "./nav-brand"
import { groupHasActive, isActivePath, useNav, type NavGroup, type NavItem } from "./nav-config"
import { useRequestSignOut } from "./sign-out-dialog"

import { PLANS_HREF, SidebarCta } from "./plan-cta"

export type ShellUser = { name: string; email: string }

type Counts = Partial<Record<string, number>>

type Account = { label: string; items: NavItem[] }

const ease = "transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
const focus = "outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"

function groupCount(group: NavGroup, counts: Counts) {
  return group.items.reduce((sum, item) => sum + (counts[item.id] ?? 0), 0)
}

// ---------- expanded sidebar ----------

const rowBase = "flex h-10 items-center gap-3 rounded-full px-4 text-[15px] [@media(max-height:900px)]:h-9"
const rowIdle = "text-sidebar-foreground hover:bg-sidebar-accent"
const rowActive = "bg-highlight font-medium text-highlight-foreground"

function CountBadge({ value, active }: { value?: number; active?: boolean }) {
  if (!value) return null
  return (
    <span className={cn("tabular ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[12px] leading-none", active ? "bg-highlight-foreground/10" : "bg-sidebar-accent")}>
      {value}
    </span>
  )
}

function NavRow({ item, pathname, counts }: { item: NavItem; pathname: string; counts: Counts }) {
  const active = isActivePath(pathname, item.href)
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(rowBase, ease, focus, active ? rowActive : rowIdle)}>
      <item.icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
      <span className="truncate">{item.label}</span>
      <CountBadge value={counts[item.id]} active={active} />
    </Link>
  )
}

function FoldedGroup({ group, pathname, counts, open, onOpenChange, footer }: { group: NavGroup; pathname: string; counts: Counts; open: boolean; onOpenChange: (open: boolean) => void; footer?: React.ReactNode }) {
  const Icon = group.icon ?? FolderIcon
  const total = groupCount(group, counts)
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className={cn("group/trigger", rowBase, "w-full text-left", ease, focus, rowIdle)}>
        <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
        <span className="truncate">{group.label}</span>
        {!open && total ? <CountBadge value={total} /> : null}
        <ChevronDownIcon
          aria-hidden
          strokeWidth={1.75}
          className={cn("size-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", open ? "rotate-180" : "", !open && total ? "" : "ml-auto")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden [--tw-animation-duration:400ms] [--tw-ease:cubic-bezier(0.2,0.8,0.2,1)] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="flex flex-col gap-0.5 pt-0.5 pb-1 pl-3">
          {group.items.map((item) => (
            <NavRow key={item.id} item={item} pathname={pathname} counts={counts} />
          ))}
          {footer}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** "Sair" at the end of the Conta group: it asks for confirmation before signing out. */
function SignOutRow() {
  const requestSignOut = useRequestSignOut()
  return (
    <button type="button" onClick={requestSignOut} className={cn(rowBase, "w-full text-left", ease, focus, rowIdle)}>
      <LogOutIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
      Sair
    </button>
  )
}

// ---------- collapsed rail: every control is the same 44 px square on one vertical axis ----------

const railBase = "relative flex size-11 shrink-0 items-center justify-center rounded-full"

function RailBadge({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="tabular absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-highlight px-1 text-[11px] leading-none font-semibold text-highlight-foreground ring-2 ring-sidebar">
      {value}
    </span>
  )
}

function RailTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function RailLink({ item, pathname, counts }: { item: NavItem; pathname: string; counts: Counts }) {
  const active = isActivePath(pathname, item.href)
  return (
    <RailTip label={item.label}>
      <Link href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} className={cn(railBase, ease, focus, active ? "bg-highlight text-highlight-foreground" : rowIdle)}>
        <item.icon aria-hidden strokeWidth={1.75} className="size-5" />
        <RailBadge value={counts[item.id]} />
      </Link>
    </RailTip>
  )
}

function RailGroup({ group, pathname, counts, footer, align = "start" }: { group: NavGroup; pathname: string; counts: Counts; footer?: (close: () => void) => React.ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false)
  const Icon = group.icon ?? FolderIcon
  const hasActive = groupHasActive(group, pathname)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <RailTip label={group.label}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={group.label} className={cn(railBase, ease, focus, hasActive ? "bg-highlight text-highlight-foreground" : rowIdle)}>
            <Icon aria-hidden strokeWidth={1.75} className="size-5" />
            <RailBadge value={groupCount(group, counts)} />
          </button>
        </PopoverTrigger>
      </RailTip>
      <PopoverContent side="right" align={align} sideOffset={14} className="w-60 gap-0 p-2">
        <p className="px-3 py-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{group.label}</p>
        {group.items.map((item) => {
          const active = isActivePath(pathname, item.href)
          return (
            <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex h-11 items-center gap-3 rounded-full px-3 text-[15px]", ease, focus, active ? rowActive : "hover:bg-accent")}>
              <item.icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
              <span className="truncate">{item.label}</span>
              <CountBadge value={counts[item.id]} active={active} />
            </Link>
          )
        })}
        {footer?.(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}

function RailUpgrade() {
  const { pro } = usePlan()
  if (pro) return null
  return (
    <RailTip label="Fazer upgrade">
      <Link href={PLANS_HREF} aria-label="Fazer upgrade" className={cn(railBase, ease, focus, rowIdle)}>
        <BadgeDollarSignIcon aria-hidden strokeWidth={1.75} className="size-5" />
      </Link>
    </RailTip>
  )
}

/** The Conta group (Configurações, Ajuda, then Sair): the same group component as Vida and Organização, pinned above the bottom card. */
function accountGroup(account: Account): NavGroup {
  return { id: "conta", label: account.label, icon: UserIcon, items: account.items }
}

/** "Sair" at the end of the Conta flyout in the collapsed rail. */
function RailSignOut({ close }: { close: () => void }) {
  const requestSignOut = useRequestSignOut()
  return (
    <button
      type="button"
      onClick={() => {
        close()
        requestSignOut()
      }}
      className={cn("flex h-11 w-full items-center gap-3 rounded-full px-3 text-left text-[15px] hover:bg-accent", ease, focus)}
    >
      <LogOutIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
      Sair
    </button>
  )
}

// ---------- the sidebar ----------

type AppSidebarProps = {
  counts: Counts
}

export const AppSidebar = memo(function AppSidebar({ counts }: AppSidebarProps) {
  const pathname = usePathname()
  const nav = useNav()
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed"
  const [mainGroup, ...foldedGroups] = nav.groups
  const account = nav.account

  // The group that contains the current page, if any.
  const accountNav = account ? accountGroup(account) : null
  const activeGroup = foldedGroups.find((g) => groupHasActive(g, pathname))?.label ?? (accountNav && groupHasActive(accountNav, pathname) ? accountNav.label : null)

  // Accordion: a single piece of state, so opening one group closes the others. It is not persisted: on load only the group
  // that holds the current route is open (none on any other route), and navigating into a group opens it.
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup)
  const [seenGroup, setSeenGroup] = useState(activeGroup)
  if (seenGroup !== activeGroup) {
    setSeenGroup(activeGroup)
    if (activeGroup) setOpenGroup(activeGroup)
  }
  const groupProps = (label: string) => ({
    open: openGroup === label,
    onOpenChange: (value: boolean) => setOpenGroup(value ? label : null),
  })

  const toggle = (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      className={cn("flex shrink-0 items-center justify-center rounded-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground", collapsed ? "size-11" : "size-9", ease, focus)}
    >
      {collapsed ? <PanelLeftOpenIcon strokeWidth={1.75} className="size-5" /> : <PanelLeftCloseIcon strokeWidth={1.75} className="size-5" />}
    </button>
  )

  if (collapsed) {
    // The top header (AppTopHeader) sits above the rail: 16 px frame padding + 44 px header row + 12 px gap.
    return (
      <Sidebar variant="floating" collapsible="icon" className="md:pt-[4.5rem]">
        <div className="flex flex-col items-center gap-1 pt-4 pb-2">
          <Link href={nav.home.href} aria-label={nav.home.label} className={cn(railBase, "rounded-xl", focus)}>
            <Logo iconOnly className="size-10" />
          </Link>
          {toggle}
        </div>
        <nav aria-label="Módulos" className="no-scrollbar flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-1">
          {mainGroup.items.map((item) => (
            <RailLink key={item.id} item={item} pathname={pathname} counts={counts} />
          ))}
          <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-sidebar-border" />
          {foldedGroups.map((group) => (
            <RailGroup key={group.label} group={group} pathname={pathname} counts={counts} />
          ))}

        </nav>
        <div className="flex shrink-0 flex-col items-center gap-1 pt-2 pb-4">
          {accountNav ? <RailGroup group={accountNav} pathname={pathname} counts={counts} align="end" footer={(close) => <RailSignOut close={close} />} /> : null}
          {nav.features.plan ? <RailUpgrade /> : <BackToAppRail />}
        </div>
        <SidebarRail />
      </Sidebar>
    )
  }

  return (
    <Sidebar variant="floating" collapsible="icon">
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-5 pb-3 [@media(max-height:900px)]:pt-4">
        <Link href={nav.home.href} aria-label={nav.home.label} className={cn("rounded-md", focus)}>
          <NavBrand logoClassName={nav.badge ? "h-7" : "h-8"} />
        </Link>
        {toggle}
      </div>

      {/* Only this list scrolls (hidden scrollbar) when the screen is too short; the bottom block never does. */}
      <nav aria-label="Módulos" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-1">
        {mainGroup.items.map((item) => (
          <NavRow key={item.id} item={item} pathname={pathname} counts={counts} />
        ))}
        {foldedGroups.map((group) => (
          <FoldedGroup key={group.label} group={group} pathname={pathname} counts={counts} {...groupProps(group.label)} />
        ))}

      </nav>

      {/* Pinned at the bottom, never scrolled away: the Conta group (Configurações, Ajuda, Sair) above the upgrade card (Free users only; the assistant lives in the quick-actions button). When Conta opens, the list above is what shrinks and scrolls. */}
      <div className="flex shrink-0 flex-col gap-2 px-3 pt-2 pb-4 empty:hidden [@media(max-height:900px)]:pb-3">
        {accountNav ? <FoldedGroup group={accountNav} pathname={pathname} counts={counts} {...groupProps(accountNav.label)} footer={<SignOutRow />} /> : null}
        {nav.features.plan ? <SidebarCta /> : <BackToAppButton className="w-full justify-start px-4" />}
      </div>
      <SidebarRail />
    </Sidebar>
  )
})
