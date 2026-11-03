"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, ChevronDownIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * One module of "Hoje" as its own card: solid surface, radius 16, hairline border that brightens when open. The WHOLE header is one
 * button (aria-expanded / aria-controls) with a single chevron that rotates; the body unfolds with a grid-rows 0fr -> 1fr animation
 * (no fixed heights), spans the card's full width and is inert while folded. Phones and desktop render this same component.
 *
 * `open` / `onToggle` are controlled by the page (an accordion: one card open at a time). `needs` only sets `data-needs`, which the
 * page's CSS uses to group the cards under "PRECISA DE VOCÊ" / "NO RITMO".
 */
export function ModuleCard({
  title,
  icon: Icon,
  subtitle,
  status,
  href,
  moduleName,
  open,
  onToggle,
  needs,
  id,
  children,
}: {
  title: string
  icon: LucideIcon
  subtitle?: React.ReactNode
  /** What shows on the right of the folded header (tabular numbers). */
  status?: React.ReactNode
  href: string
  /** "Abrir Estudos →" */
  moduleName: string
  open: boolean
  onToggle: () => void
  needs: boolean
  id: string
  children: React.ReactNode
}) {
  const bodyId = useId()
  const section = useRef<HTMLElement>(null)
  const [animating, setAnimating] = useState(false)

  // After opening, bring the card into view (nearest edge, smooth). The grid animation changes the height, so wait for it to end;
  // with reduced motion there is no animation and it happens right away.
  useEffect(() => {
    if (!open) return
    const el = section.current
    if (!el) return
    if (prefersReducedMotion()) {
      el.scrollIntoView({ block: "nearest", behavior: "auto" })
      return
    }
    const timer = window.setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 400)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <section
      ref={section}
      aria-label={title}
      data-module-card={id}
      data-open={open ? "" : undefined}
      data-needs={needs ? "true" : "false"}
      className={cn("flex min-w-0 flex-col rounded-[16px] border bg-card transition-colors duration-[400ms] motion-reduce:transition-none", EASE, open ? "border-foreground/22" : "border-foreground/6")}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-[16px] p-4 text-left outline-none hover:bg-foreground/4 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] leading-6 font-semibold">{title}</span>
          {subtitle ? <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">{subtitle}</span> : null}
        </span>
        {status ? <span className="tabular flex shrink-0 items-center gap-2 text-[13px] leading-5">{status}</span> : null}
        <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", EASE, open && "rotate-180")} />
      </button>
      <div
        id={bodyId}
        onTransitionStart={() => setAnimating(true)}
        onTransitionEnd={() => setAnimating(false)}
        className={cn("grid transition-[grid-template-rows,opacity] duration-[400ms] motion-reduce:transition-none", EASE, open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <div inert={!open} data-animating={animating ? "" : undefined} className="min-h-0 overflow-hidden">
          <div className="flex min-w-0 flex-col gap-[14px] px-4 pb-4">{children}</div>
          {/* Footer: 1 px hairline + 40 px (44 px on phones) in total, 16 px side padding, and the card ends right after it. */}
          <Link href={href} className="flex h-11 items-center gap-1.5 rounded-b-[16px] border-t border-border px-4 text-[14px] leading-5 font-medium outline-none hover:bg-foreground/4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:h-10">
            Abrir {moduleName} <ArrowRightIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
