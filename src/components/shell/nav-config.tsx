"use client"

import { createContext, useContext } from "react"
import type { LucideIcon } from "lucide-react"

export type NavItem = { id: string; label: string; href: string; icon: LucideIcon }

export type NavGroup = {
  id: string
  label: string
  /** Icon of the folded group (sidebar accordion, rail flyout, collapsed header). The first group has none: it is always flat. */
  icon?: LucideIcon
  items: NavItem[]
}

export type PageMeta = { title: string; subtitle: string }

export type MobileSection = { label?: string; items: NavItem[] }

/**
 * Everything the shell needs to know about WHERE it is: the same shell (header, sidebar, rail, mobile header, floating pill,
 * command palette) renders `appNav` under /dashboard and `adminNav` under /admin.
 */
export type NavConfig = {
  id: "app" | "admin"
  /** The logo links here. */
  home: { href: string; label: string }
  /** Small badge next to the logo ("Admin"). */
  badge?: string
  /** `groups[0]` is always visible and flat; the others fold in the sidebar. */
  groups: NavGroup[]
  /** Last accordion group of the sidebar (app: Configurações). Admin has none. */
  account: { label: string; items: NavItem[] } | null
  mobile: {
    /** Direct slots of the floating pill. The "more" slot is appended after them. */
    pill: NavItem[]
    more: { label: string; title: string; sections: MobileSection[] }
  }
  pageMeta: Record<string, PageMeta>
  features: {
    /** Assistant button + sheet, and the "Novo" quick capture. */
    assistant: boolean
    /** Notification bell. */
    notifications: boolean
    /** Plan card in the sidebar, upgrade button in the header. */
    plan: boolean
    /** The home route greets the user instead of showing a static title. */
    greeting: boolean
  }
}

export const MORE_ID = "mais"

/** The home route matches exactly; every other route also matches its sub-routes. */
const EXACT = new Set(["/dashboard", "/admin"])

export function isActivePath(pathname: string, href: string) {
  if (EXACT.has(href)) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function groupHasActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => isActivePath(pathname, item.href))
}

export function metaFor(nav: NavConfig, pathname: string): PageMeta | null {
  const key = Object.keys(nav.pageMeta).find((k) => pathname === k || pathname.startsWith(`${k}/`))
  return key ? nav.pageMeta[key] : null
}

/** Sections of the "more" sheet: every item that has no slot in the floating pill, grouped like the sidebar. */
export function moreSections(groups: NavGroup[], pillHrefs: string[], { headlessMain }: { headlessMain: boolean }): MobileSection[] {
  return groups
    .map((group, index) => ({
      label: index === 0 && headlessMain ? undefined : group.label,
      items: group.items.filter((item) => !pillHrefs.includes(item.href)),
    }))
    .filter((section) => section.items.length > 0)
}

type NavContextValue = { nav: NavConfig; isAdmin: boolean }

const NavContext = createContext<NavContextValue | null>(null)

export const NavProvider = NavContext.Provider

export function useNavContext() {
  const value = useContext(NavContext)
  if (!value) throw new Error("useNav must be used inside the shell")
  return value
}

export function useNav() {
  return useNavContext().nav
}
