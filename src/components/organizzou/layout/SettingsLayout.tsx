"use client"

import { useEffect, useRef, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type SettingsSection = { id: string; label: string; icon?: LucideIcon }

type SettingsLayoutProps = {
  sections: SettingsSection[]
  active: string
  onChange: (id: string) => void
  children: ReactNode
  className?: string
}

/**
 * Settings pattern: a vertical nav on the left from 1024 px, horizontally scrollable tabs below (the active tab scrolls into
 * view, labels are never truncated), and the content in a `max-w-5xl` column.
 */
export function SettingsLayout({ sections, active, onChange, children, className }: SettingsLayoutProps) {
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
  }, [active])

  return (
    <div className={cn("flex min-w-0 flex-col gap-5 lg:flex-row lg:gap-10", className)}>
      {/* Phones and tablets: scrollable tabs with snap. */}
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Seções"
        className="no-scrollbar -mx-4 flex snap-x gap-1 overflow-x-auto px-4 md:mx-0 md:px-0 lg:hidden"
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active === section.id}
            onClick={() => onChange(section.id)}
            className={cn(
              "inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-[15px] whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              active === section.id ? "bg-highlight font-medium text-highlight-foreground" : "text-foreground hover:bg-accent"
            )}
          >
            {section.icon ? <section.icon aria-hidden strokeWidth={1.75} className="size-[18px]" /> : null}
            {section.label}
          </button>
        ))}
      </div>

      {/* Desktop: vertical nav. */}
      <nav aria-label="Seções" className="hidden w-56 shrink-0 flex-col gap-1 lg:flex">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={active === section.id ? "page" : undefined}
            onClick={() => onChange(section.id)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-full px-4 text-left text-[15px] outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              active === section.id ? "bg-highlight font-medium text-highlight-foreground" : "text-foreground hover:bg-accent"
            )}
          >
            {section.icon ? <section.icon aria-hidden strokeWidth={1.75} className="size-[18px]" /> : null}
            {section.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 max-w-5xl flex-1">{children}</div>
    </div>
  )
}
