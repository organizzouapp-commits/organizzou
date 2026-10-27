import Link from "next/link"
import { ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** 12-column bento grid, gap 20 px (DESIGN-SYSTEM §5.1). Cards pick their spans with Tailwind classes. */
export function Bento({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-12 gap-5", className)}>{children}</div>
}

type BentoCardProps = {
  title?: string
  /** Round outline arrow button in the header; also shows the "Ver tudo" link when `linkLabel` is set. */
  href?: string
  linkLabel?: string
  /** Extra controls in the header, before the arrow. */
  actions?: React.ReactNode
  /** One highlighted (Lima) card per screen. */
  tone?: "default" | "highlight"
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

const cardBase = "min-w-0 rounded-[24px] p-6"

export function bentoCardClass(tone: "default" | "highlight" = "default") {
  return cn(cardBase, tone === "highlight" ? "border border-transparent bg-highlight text-highlight-foreground" : "glass-card text-card-foreground")
}

export function ArrowLink({ href, label, tone = "default" }: { href: string; label: string; tone?: "default" | "highlight" }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border outline-none transition-colors duration-120 focus-visible:ring-3 focus-visible:ring-ring/50",
        tone === "highlight" ? "border-highlight-foreground/30 hover:bg-highlight-foreground/10" : "border-border hover:bg-accent"
      )}
    >
      <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className="size-4" />
    </Link>
  )
}

export function BentoCard({ title, href, linkLabel, actions, tone = "default", className, bodyClassName, children }: BentoCardProps) {
  return (
    <section aria-label={title} className={cn(bentoCardClass(tone), "flex flex-col gap-5", className)}>
      {title || href || actions ? (
        <header className="flex items-center justify-between gap-3">
          {title ? <h2 className="text-[17px] leading-6 font-semibold">{title}</h2> : <span />}
          <div className="flex items-center gap-2">
            {actions}
            {href && linkLabel ? (
              <Link
                href={href}
                className="hidden rounded-md text-[13px] leading-5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline"
              >
                {linkLabel}
              </Link>
            ) : null}
            {href ? <ArrowLink href={href} label={linkLabel ?? `Abrir ${title ?? ""}`} tone={tone} /> : null}
          </div>
        </header>
      ) : null}
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}

type KpiCardProps = {
  label: string
  value: string
  /** Small delta or support line under the number. */
  support?: string
  trend?: "up" | "down"
  href?: string
  tone?: "default" | "highlight"
  className?: string
}

/** Big number card. Numbers use tabular-nums; the optional trend arrow never relies on color. */
export function KpiCard({ label, value, support, trend, href, tone = "default", className }: KpiCardProps) {
  const highlight = tone === "highlight"
  return (
    <section aria-label={label} className={cn(bentoCardClass(tone), "flex flex-col gap-3", className)}>
      <header className="flex items-start justify-between gap-3">
        <span className={cn("text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase", highlight ? "text-highlight-foreground/70" : "text-muted-foreground")}>
          {label}
        </span>
        {href ? <ArrowLink href={href} label={`Abrir ${label}`} tone={tone} /> : null}
      </header>
      <span
        className={cn(
          "tabular flex items-center gap-1.5 font-semibold tracking-[-0.02em] whitespace-nowrap",
          // Long values (currency, kg) step down so they never wrap inside a quarter-width card.
          value.length > 8 ? "text-2xl leading-8 xl:text-[26px]" : "text-[30px] leading-9 md:text-4xl md:leading-10"
        )}
      >
        {trend === "up" ? <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className="size-6" /> : null}
        {trend === "down" ? <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className="size-6 rotate-90" /> : null}
        {value}
      </span>
      {support ? (
        <span className={cn("tabular text-[13px] leading-5", highlight ? "text-highlight-foreground/70" : "text-muted-foreground")}>{support}</span>
      ) : null}
    </section>
  )
}
