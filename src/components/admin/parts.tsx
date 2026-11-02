import Link from "next/link"
import { ArrowDownRightIcon, ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon, MinusIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react"

import { bentoCardClass } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { SoonBadge } from "@/components/organizzou/SoonBadge"
import { Button } from "@/components/ui/button"
import { fmtInt, fmtPct, type Variation } from "@/lib/admin/format"
import { cn } from "@/lib/utils"

/**
 * "+12 (+8%) vs 7 dias anteriores": the direction is an arrow icon and a sign, never a color (no red/green status colors).
 * Without a base to compare with it says so instead of inventing one.
 */
export function DeltaLine({ variation, compareLabel, tone = "default" }: { variation: Variation | null; compareLabel: string; tone?: "default" | "highlight" }) {
  const muted = tone === "highlight" ? "text-highlight-foreground/70" : "text-muted-foreground"
  if (!variation) return <span className={cn("text-[13px] leading-5", muted)}>Sem base de comparação</span>
  const { diff, ratio } = variation
  const Icon = diff > 0 ? ArrowUpRightIcon : diff < 0 ? ArrowDownRightIcon : MinusIcon
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : ""
  return (
    <span className={cn("tabular flex items-center gap-1 text-[13px] leading-5", muted)}>
      <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
      <span>
        {sign}
        {fmtInt(Math.abs(diff))}
        {ratio != null ? ` (${sign}${fmtPct(Math.abs(ratio))})` : ""} {compareLabel}
      </span>
    </span>
  )
}

type AdminKpiProps = {
  label: string
  value: number | null
  variation: Variation | null
  compareLabel: string
  /** One Lima KPI per screen. */
  tone?: "default" | "highlight"
  href?: string
}

export function AdminKpi({ label, value, variation, compareLabel, tone = "default", href }: AdminKpiProps) {
  const highlight = tone === "highlight"
  const body = (
    <section aria-label={label} className={cn(bentoCardClass(tone), "flex h-full flex-col gap-3")}>
      <span className={cn("text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase", highlight ? "text-highlight-foreground/70" : "text-muted-foreground")}>{label}</span>
      <span className="tabular text-[30px] leading-9 font-semibold tracking-[-0.02em] md:text-4xl md:leading-10">{fmtInt(value)}</span>
      <DeltaLine variation={variation} compareLabel={compareLabel} tone={tone} />
    </section>
  )
  if (!href) return body
  return (
    <Link href={href} className="rounded-[24px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  )
}

/** A read failed: the migrations may not be applied yet, or the admin schema is not exposed to the API. Never hides behind zeros. */
export function DataUnavailable({ error, title = "Não foi possível carregar estes dados" }: { error?: string; title?: string }) {
  return (
    <div role="alert" className={cn(bentoCardClass(), "flex flex-col gap-2")}>
      <EmptyState
        icon={TriangleAlertIcon}
        title={title}
        description="Confira se as migrations do admin foram aplicadas e se o schema admin está exposto na API (docs/ADMIN.md)."
        className="py-6"
      />
      {error ? <p className="tabular text-center text-[13px] leading-5 break-words text-muted-foreground">{error}</p> : null}
    </div>
  )
}

/** A placeholder for something that is not built. Always says what is missing; never shows a number. */
export function ComingSoon({ icon: Icon, title, description, needs, className }: { icon: LucideIcon; title: string; description: string; needs?: string; className?: string }) {
  return (
    <section aria-label={title} className={cn(bentoCardClass(), "flex h-full flex-col gap-3", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
          <h2 className="text-[17px] leading-6 font-semibold">{title}</h2>
        </div>
        <SoonBadge />
      </header>
      <p className="text-[15px] leading-6 text-muted-foreground">{description}</p>
      {needs ? <p className="text-[13px] leading-5 text-muted-foreground">Precisa de: {needs}</p> : null}
    </section>
  )
}

export type SegmentOption = { value: string; label: string; href: string }

/** A segmented control made of links (works without JavaScript, the choice lives in the URL). */
export function SegmentedLinks({ label, options, active }: { label: string; options: SegmentOption[]; active: string }) {
  return (
    <nav aria-label={label} className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-full border border-border bg-card p-[3px]">
      {options.map((option) => {
        const current = option.value === active
        return (
          <Link
            key={option.value}
            href={option.href}
            scroll={false}
            aria-current={current ? "true" : undefined}
            className={cn(
              "inline-flex h-full items-center rounded-full px-4 text-[15px] outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              current ? "bg-highlight font-medium text-highlight-foreground" : "text-foreground hover:bg-accent"
            )}
          >
            {option.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Previous / next with the page count. `hrefFor` returns the URL of a page. */
export function Pager({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
      <p className="tabular text-[13px] leading-5 text-muted-foreground">
        {fmtInt(total)} {total === 1 ? "resultado" : "resultados"} · página {fmtInt(Math.min(page, pages))} de {fmtInt(pages)}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" className="h-11 rounded-full px-4">
            <Link href={hrefFor(page - 1)} scroll={false}>
              <ChevronLeftIcon strokeWidth={1.75} /> Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="h-11 rounded-full px-4" disabled>
            <ChevronLeftIcon strokeWidth={1.75} /> Anterior
          </Button>
        )}
        {page < pages ? (
          <Button asChild variant="outline" className="h-11 rounded-full px-4">
            <Link href={hrefFor(page + 1)} scroll={false}>
              Próxima <ChevronRightIcon strokeWidth={1.75} />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="h-11 rounded-full px-4" disabled>
            Próxima <ChevronRightIcon strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </nav>
  )
}

/**
 * A line of explanation at the top of a page. The shell clips the page to rounded 24 px corners, so bare text that touches the top-left
 * corner loses its first letters: the inset keeps it clear (cards never need it, they have their own radius).
 */
export function Intro({ icon: Icon, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <p role="note" className={cn("flex max-w-[72ch] items-start gap-3 px-3 pt-3 text-[15px] leading-6 text-muted-foreground", className)}>
      {Icon ? <Icon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" /> : null}
      <span>{children}</span>
    </p>
  )
}

/** Wraps a table in the card with horizontal scroll (phones never get a page-level horizontal scroll). */
export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(bentoCardClass(), "overflow-hidden p-0", className)}>{children}</div>
}
