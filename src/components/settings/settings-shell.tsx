"use client"

import { useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"

import { PillTabs } from "@/components/tasks/pill-tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import type { PlanUsage } from "@/lib/plan-usage"
import { SETTINGS_TABS, parseSettingsTab, type SettingsTab } from "@/lib/settings-tabs"

import type { SettingsProfile } from "./tabs/profile-tab"

// One lazy segment per tab: only the open tab's code is loaded.
const loading = () => <Skeleton className="h-72 w-full rounded-[24px]" />
const ProfileTab = dynamic(() => import("./tabs/profile-tab"), { loading })
const NotificationsTab = dynamic(() => import("./tabs/notifications-tab"), { loading })
const SecurityTab = dynamic(() => import("./tabs/security-tab"), { loading })
const PlanTab = dynamic(() => import("./tabs/plan-tab"), { loading })

const TAB_ITEMS = SETTINGS_TABS.map((tab) => ({ id: tab.id, label: tab.label }))

/** The tab row with soft fades at the ends that still have something to scroll to (it scrolls on phones; the active tab is kept in view by PillTabs). */
function FadingTabs({ active, onChange, className }: { active: SettingsTab; onChange: (tab: SettingsTab) => void; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const update = useCallback(() => {
    const row = wrap.current?.querySelector<HTMLElement>("[data-pill-row]")
    if (!wrap.current || !row) return
    const max = row.scrollWidth - row.clientWidth
    wrap.current.style.setProperty("--fade-l", row.scrollLeft > 4 ? "28px" : "0px")
    wrap.current.style.setProperty("--fade-r", max - row.scrollLeft > 4 ? "28px" : "0px")
  }, [])
  useEffect(() => {
    update()
    const id = window.setTimeout(update, 450) // after the active tab has scrolled into view
    window.addEventListener("resize", update)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener("resize", update)
    }
  }, [active, update])
  return (
    <div ref={wrap} onScrollCapture={update} className={className}>
      <PillTabs ariaLabel="Seções de Configurações" items={TAB_ITEMS} value={active} onSelect={(item) => onChange(item.id as SettingsTab)} className="fade-x w-full" />
    </div>
  )
}

/**
 * Configurações: Perfil, Avisos, Segurança e dados and Plano e cobrança in one page. The open tab lives in the URL (?aba=…) and
 * switching it changes only the URL (no server round trip). Desktop: tabs under the title, content in a 12-column bento grid; phones: a
 * solid header card with a scrollable tab row.
 */
export function SettingsShell({ profile, usage }: { profile: SettingsProfile; usage: PlanUsage }) {
  const params = useSearchParams()
  const active = parseSettingsTab(params.get("aba"))
  const isMobile = useIsMobile()

  function change(tab: SettingsTab) {
    const url = new URL(window.location.href)
    url.searchParams.set("aba", tab)
    window.history.replaceState(null, "", url)
  }

  return (
    <div data-testid="settings" data-tab={active} className={`flex min-w-0 flex-col gap-4${isMobile ? " pb-24" : ""}`}>
      {isMobile ? (
        <section aria-label="Configurações" data-testid="settings-header" className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-3">
          <div className="min-w-0 px-1">
            <h2 className="truncate text-[18px] leading-6 font-semibold">Configurações</h2>
            <p className="text-[13px] leading-5 text-muted-foreground">Conta, aparência, avisos e plano em um só lugar.</p>
          </div>
          <FadingTabs active={active} onChange={change} className="-mx-3 px-3" />
        </section>
      ) : (
        <FadingTabs active={active} onChange={change} className="max-w-full" />
      )}

      <div role="tabpanel" aria-label={SETTINGS_TABS.find((t) => t.id === active)?.label} className="min-w-0">
        {active === "perfil" ? <ProfileTab profile={profile} /> : null}
        {active === "avisos" ? <NotificationsTab /> : null}
        {active === "seguranca" ? <SecurityTab /> : null}
        {active === "plano" ? <PlanTab email={profile.email} name={profile.displayName} usage={usage} /> : null}
      </div>
    </div>
  )
}
