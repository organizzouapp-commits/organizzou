"use client"

import { useEffect, useId, useRef } from "react"
import { ArrowUpRightIcon, type LucideIcon } from "lucide-react"

import { useLabelColors } from "@/components/tasks/label-colors-context"
import type { AccountRow } from "@/features/finance/types"
import { resolveHex } from "@/features/tasks/colors"
import { formatBRL } from "@/lib/money"
import { swatches, type SwatchId } from "@/lib/swatches"
import { cn } from "@/lib/utils"

import { MoneyText, SUMMARY_CARD } from "./parts"

// ------------------------------------------------------------------ cards

/** The bento card: radius 20, a title (and subtitle) on the left, an optional circle arrow on the right that goes to the related tab. */
export function BentoCard({ title, subtitle, onArrow, arrowLabel, actions, children, className, ...data }: { title: string; subtitle?: string; onArrow?: () => void; arrowLabel?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; [key: `data-${string}`]: string | undefined }) {
  return (
    <section aria-label={title} data-bento-card className={cn(SUMMARY_CARD, "flex min-w-0 flex-col gap-3 p-4 md:p-5", className)} {...data}>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] leading-6 font-semibold">{title}</h3>
          {subtitle ? <p className="truncate text-[13px] leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onArrow ? (
            <button type="button" aria-label={arrowLabel ?? `Abrir ${title}`} onClick={onArrow} className="relative flex size-9 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] after:absolute after:-inset-1 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
              <ArrowUpRightIcon aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

/** The bento stat: an uppercase label with an icon circle at the top right, the big number (cents dimmed) and an outlined helper chip. */
export function BentoStat({ label, icon: Icon, children, chip, chipIcon: ChipIcon, compact = false, className }: { label: string; icon: LucideIcon; children: React.ReactNode; chip?: string; chipIcon?: LucideIcon; compact?: boolean; className?: string }) {
  return (
    <section aria-label={label} data-stat-tile data-bento-stat className={cn(SUMMARY_CARD, "flex min-w-0 flex-col", compact ? "gap-1.5 p-3" : "gap-2 p-4 md:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("truncate font-medium tracking-[0.08em] text-muted-foreground uppercase", compact ? "text-[10px] leading-4" : "text-[11px] leading-4")}>{label}</span>
        <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full border border-border", compact ? "size-6" : "size-8")}>
          <Icon strokeWidth={1.75} className={compact ? "size-3" : "size-4"} />
        </span>
      </div>
      <span className={cn("tabular font-semibold whitespace-nowrap", compact ? "text-[16px] leading-6" : "text-[24px] leading-8 tracking-[-0.01em]")}>{children}</span>
      {chip ? (
        <span data-stat-chip className="mt-auto inline-flex h-6 w-fit max-w-full items-center gap-1 rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground">
          {ChipIcon ? <ChipIcon aria-hidden strokeWidth={1.75} className="size-3 shrink-0" /> : null}
          <span className="truncate">{chip}</span>
        </span>
      ) : null}
    </section>
  )
}

/** Mensal | Anual, Lista | Linha, Todos | Entradas | Saídas: an inline container with the active pill in Lima. */
export function SegmentedPills<T extends string>({ items, value, onChange, ariaLabel, className }: { items: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; ariaLabel: string; className?: string }) {
  return (
    <div role="group" aria-label={ariaLabel} data-segmented className={cn("inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-muted p-0.5", className)}>
      {items.map((item) => {
        const on = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            data-pill
            onClick={() => onChange(item.id)}
            className={cn(
              "relative inline-flex h-8 items-center justify-center rounded-full px-3 text-[13px] leading-5 whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              on ? "bg-highlight font-semibold text-highlight-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className={cn("tabular ml-1.5", on ? "opacity-70" : "opacity-80")}>{item.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ charts

export type CashflowMonth = { key: string; label: string; income: number; expense: number }

const HATCH = "repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 30%, transparent) 0 1.5px, transparent 1.5px 5px)"

/** A "nice" axis: the step (500, 1.000, 2.500, 5.000, ...) and how many steps reach the tallest bar (cents in, cents out). */
function niceAxis(maxCents: number) {
  const reais = Math.max(1, maxCents / 100)
  const steps = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]
  const step = steps.find((s) => reais / s <= 4) ?? 100000
  const count = Math.max(1, Math.ceil(reais / step))
  return { step: step * 100, count }
}

const tickLabel = (cents: number) => {
  const reais = cents / 100
  return reais >= 1000 ? `${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(reais)
}

/**
 * Paired bars per month (entradas / saídas) over a y-axis with dashed grid lines. Months that are not selected are hatched gray; the
 * selected one is Lima + light gray with a light tooltip (Lima dot, month, entradas, saídas) and a bold label. Tap, click, or the arrow
 * keys select a month. The group has an aria-label summary.
 */
export function CashflowChart({ data, selected, onSelect, ariaLabel, className }: { data: CashflowMonth[]; selected: number; onSelect: (index: number) => void; ariaLabel: string; className?: string }) {
  const { step, count } = niceAxis(Math.max(1, ...data.flatMap((m) => [m.income, m.expense])))
  const axisMax = step * count
  const current = data[selected]
  const center = ((selected + 0.5) / data.length) * 100
  const AXIS = 40
  return (
    <div role="group" aria-label={ariaLabel} data-testid="cashflow-chart" className={cn("relative h-[210px] md:h-[230px]", className)}>
      <div aria-hidden className="pointer-events-none absolute right-0 bottom-6 top-16" style={{ left: 0 }}>
        {Array.from({ length: count + 1 }, (_, i) => (
          <div key={i} data-tick className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(i / count) * 100}%`, transform: "translateY(50%)" }}>
            <span className="tabular w-8 shrink-0 text-right text-[11px] leading-4 text-muted-foreground">{i === 0 ? "0" : tickLabel(i * step)}</span>
            <span className="flex-1 border-t border-dashed border-border" />
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 right-0 flex" style={{ left: AXIS }}>
        {data.map((m, i) => {
          const on = i === selected
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              data-month={m.key}
              aria-label={`${m.label}: entradas ${formatBRL(m.income)}, saídas ${formatBRL(m.expense)}`}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                const next = e.key === "ArrowRight" ? Math.min(data.length - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? data.length - 1 : null
                if (next === null) return
                e.preventDefault()
                onSelect(next)
                ;(e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus()
              }}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-end rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex h-[calc(100%-24px)] w-full items-end justify-center gap-[3px] pt-16">
                {([["income", m.income], ["expense", m.expense]] as const).map(([kind, value]) => (
                  <span
                    key={kind}
                    data-bar={kind}
                    className="w-[34%] max-w-4 rounded-t-md rounded-b-[3px] transition-[background-color,height] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                    style={{
                      height: `${Math.max(value > 0 ? 2 : 0, (value / axisMax) * 100)}%`,
                      ...(on ? { backgroundColor: kind === "income" ? "var(--highlight)" : "color-mix(in oklab, var(--foreground) 22%, transparent)" } : { backgroundImage: HATCH, backgroundColor: "color-mix(in oklab, var(--foreground) 8%, transparent)" }),
                    }}
                  />
                ))}
              </span>
              <span className={cn("h-6 pt-1 text-[12px] leading-5 capitalize", on ? "font-bold" : "text-muted-foreground")}>{m.label}</span>
            </button>
          )
        })}
      </div>
      {current ? (
        <div data-testid="cashflow-tooltip" role="status" className="pointer-events-none absolute top-0 z-10 w-[172px] -translate-x-1/2 rounded-[12px] border border-border bg-popover px-3 py-2 text-popover-foreground" style={{ left: `clamp(${AXIS + 86}px, calc(${AXIS}px + (100% - ${AXIS}px) * ${center / 100}), calc(100% - 86px))` }}>
          <div className="flex items-center gap-1.5 text-[12px] leading-4 font-semibold capitalize">
            <span aria-hidden data-tooltip-dot className="size-2 rounded-full bg-highlight" />
            {current.label}
          </div>
          <div className="tabular flex justify-between gap-2 text-[12px] leading-5">
            <span className="text-muted-foreground">Entradas</span>
            <span className="whitespace-nowrap">{formatBRL(current.income)}</span>
          </div>
          <div className="tabular flex justify-between gap-2 text-[12px] leading-5">
            <span className="text-muted-foreground">Saídas</span>
            <span className="whitespace-nowrap">{formatBRL(current.expense)}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** The budget ring: 128px, 14px stroke with round caps, Lima on a neutral track (Tinta on Papel), "20%" and "usado" inside. */
export function BudgetRing({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const r = 57
  const c = 2 * Math.PI * r
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-budget-ring className={cn("relative size-32 shrink-0", className)}>
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="14" className="stroke-muted" />
        {pct > 0 ? <circle cx="64" cy="64" r={r} fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} /> : null}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[28px] leading-8 font-semibold">{pct}%</span>
        <span className="text-[12px] leading-4 text-muted-foreground">usado</span>
      </span>
    </div>
  )
}

export type DonutSegment = { id: string; name: string; value: number; count?: number }

const FALLBACK = ["var(--chart-1)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)", "var(--chart-2)"]

/** Segment colors: the one the person gave the category, else a palette token. */
export function useSegmentColors(segments: DonutSegment[]) {
  const colors = useLabelColors()
  return segments.map((s, i) => resolveHex(colors.colorOf("category", s.id)) ?? FALLBACK[i % FALLBACK.length])
}

/** The arcs of a donut: positive values only, biggest first, a 2.5° gap between neighbours and at least 1.5% of the ring for a tiny slice (the rest shrinks to make room). Pure, so it can be tested. */
export function donutArcs(values: number[], circumference: number) {
  const positive = values.map((value, index) => ({ value, index })).filter((v) => v.value > 0)
  const total = positive.reduce((sum, v) => sum + v.value, 0)
  if (total === 0) return []
  const lens = positive.map((v) => Math.max(v.value / total, 0.015))
  const sum = lens.reduce((a, b) => a + b, 0)
  const gap = positive.length > 1 ? (2.5 / 360) * circumference : 0
  let cursor = 0
  return positive.map((v, i) => {
    const len = (lens[i] / sum) * circumference
    const arc = { index: v.index, dash: Math.max(0.5, len - gap), offset: cursor + gap / 2, share: v.value / total }
    cursor += len
    return arc
  })
}

/**
 * A multi-segment donut (136px, 16px stroke, butt caps, 12 o'clock start) in the categories' own colors, biggest first like its legend. The
 * total (scaled down when long) and the count sit inside the inner diameter. `side`: legend beside it (it drops below on narrow cards);
 * `stacked`: donut centered and a full-width legend below with a percentage column.
 */
export function CategoryDonut({ segments, label, variant = "side", unit = ["lançamento", "lançamentos"], className }: { segments: DonutSegment[]; label: string; variant?: "side" | "stacked"; unit?: [string, string]; className?: string }) {
  const sorted = segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((sum, s) => sum + s.value, 0)
  const count = sorted.reduce((sum, s) => sum + (s.count ?? 0), 0)
  const colors = useSegmentColors(sorted)
  const r = 44
  const c = 2 * Math.PI * r
  const arcs = donutArcs(sorted.map((s) => s.value), c)
  const stacked = variant === "stacked"
  const totalText = `R$ ${Math.round(total / 100).toLocaleString("pt-BR")}`
  const size = totalText.length <= 8 ? "text-[16px]" : totalText.length <= 10 ? "text-[14px]" : "text-[12px]"
  return (
    <div data-testid="category-donut" data-variant={variant} className={cn("@container w-full", className)}>
      <div className={cn("flex flex-col items-center gap-4", !stacked && "@[320px]:flex-row @[320px]:gap-5")}>
        <div role="img" aria-label={`${label}: ${sorted.map((s) => `${s.name} ${formatBRL(s.value)}`).join(", ") || "sem dados"}`} className="relative size-[136px] shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" strokeWidth="16" className="stroke-muted" />
            {arcs.map((a) => (
              <circle key={sorted[a.index].id} data-segment={sorted[a.index].id} data-share={a.share.toFixed(4)} cx="60" cy="60" r={r} fill="none" strokeWidth="16" strokeLinecap="butt" stroke={colors[a.index]} strokeDasharray={`${a.dash} ${c - a.dash}`} strokeDashoffset={-a.offset} />
            ))}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="flex w-[78px] flex-col items-center">
              <span data-donut-total className={cn("tabular leading-6 font-semibold whitespace-nowrap", size)}>{totalText}</span>
              <span className="text-[11px] leading-4 whitespace-nowrap text-muted-foreground">{count ? `${count} ${count === 1 ? unit[0] : unit[1]}` : "Total"}</span>
            </span>
          </span>
        </div>
        <ul className={cn("flex min-w-0 flex-col self-stretch", !stacked && "@[320px]:flex-1 @[320px]:justify-center")}>
          {sorted.map((s, i) => (
            <li key={s.id} data-legend={s.id} className={cn("grid h-7 min-w-0 items-center gap-2 text-[13px] leading-5", stacked ? "grid-cols-[10px_minmax(0,1fr)_auto_40px]" : "grid-cols-[10px_minmax(0,1fr)_auto]")}>
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: colors[i] }} />
              <span className="truncate">{s.name}</span>
              <span className="tabular text-right whitespace-nowrap">{formatBRL(s.value)}</span>
              {stacked ? <span className="tabular text-right text-muted-foreground">{total ? Math.round((s.value / total) * 100) : 0}%</span> : null}
            </li>
          ))}
          {sorted.length === 0 ? <li className="text-[13px] leading-5 text-muted-foreground">Sem dados neste mês.</li> : null}
        </ul>
      </div>
    </div>
  )
}

/** A small Lima area line. `points` is the running total; fewer than two points draws nothing (the caller hides it). */
export function Sparkline({ points, label, tone = "inverse", className }: { points: number[]; label: string; /** "inverse": Lima on a dark surface; "default": the primary color (Lima on dark, Tinta on Papel). */ tone?: "default" | "inverse"; className?: string }) {
  const ink = tone === "inverse" ? "var(--palette-lima)" : "var(--primary)"
  const id = useId()
  if (points.length < 2) return null
  const w = 160
  const h = 44
  const min = Math.min(...points)
  const span = Math.max(1, Math.max(...points) - min)
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 4 - ((p - min) / span) * (h - 10)] as const)
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  return (
    <svg role="img" aria-label={label} data-sparkline viewBox={`0 0 ${w} ${h}`} className={cn("h-11 w-full", className)} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={ink} stopOpacity="0.35" />
          <stop offset="100%" stopColor={ink} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ------------------------------------------------------------------ wallets and timeline

/** A wallet: the icon circle (tinted with the account's swatch), the name and balance, a status chip; tapping the card opens `onOpen`, the ⋯ menu comes from `menu`. */
export function WalletMiniCard({ account, balance, icon: Icon, swatch, chip = "Ativa", onOpen, menu, className }: { account: AccountRow; balance: number; icon: LucideIcon; swatch?: SwatchId; chip?: string; onOpen?: () => void; menu?: React.ReactNode; className?: string }) {
  const tint = swatch && swatch !== "neutro"
  return (
    <div data-account={account.id} data-wallet className={cn("relative flex min-w-0 flex-col gap-2 rounded-[14px] border border-border bg-card p-3", className)}>
      <div className="flex items-start justify-between">
        <span aria-hidden className={cn("flex size-9 items-center justify-center rounded-full border", tint ? cn("border-transparent", swatches[swatch].fill, swatch === "grafite" || swatch === "tinta-verso" ? "text-palette-papel" : "text-palette-tinta") : "border-border bg-muted/50")}>
          <Icon strokeWidth={1.75} className="size-4" />
        </span>
        <span className="-mt-1 -mr-1 relative z-10">{menu}</span>
      </div>
      <button type="button" data-wallet-open onClick={onOpen} disabled={!onOpen} className="flex min-w-0 flex-col text-left outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50">
        <span className="truncate text-[13px] leading-5 text-muted-foreground">{account.name}</span>
        <MoneyText cents={balance} tone="value" dimDecimals className="text-[16px] leading-6 font-semibold" />
      </button>
      <span className="inline-flex h-6 w-fit items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 text-muted-foreground">{chip}</span>
    </div>
  )
}

/** Days of the month as chips: a dot where a bill is due, Lima for today, an outline for the chosen day. Scrolls and snaps on phones. */
export function MonthTimeline({ days, today, dots, selected, onSelect, monthLabel, className }: { days: number; today: number | null; dots: Record<number, number>; selected: number | null; onSelect: (day: number) => void; monthLabel: string; className?: string }) {
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Keep the chosen day in view when the row scrolls (phones).
    row.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest" })
  }, [selected])
  return (
    <div ref={row} role="group" aria-label={`Linha do mês, ${monthLabel}`} data-testid="month-timeline" className={cn("scroll-soft flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-2.5", className)}>
      {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
        const count = dots[day] ?? 0
        const on = selected === day
        const isToday = today === day
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={`Dia ${day}${count ? `, ${count} ${count === 1 ? "conta vence" : "contas vencem"}` : ""}${isToday ? ", hoje" : ""}`}
            data-day={day}
            data-today={isToday ? "" : undefined}
            onClick={() => onSelect(day)}
            className={cn(
              "flex h-16 w-11 min-w-11 shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-[14px] border text-center outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:w-auto md:min-w-0 md:flex-1",
              isToday ? "border-transparent bg-highlight text-highlight-foreground" : "border-border hover:bg-accent",
              on && "outline-2 outline-offset-1 outline-foreground"
            )}
          >
            <span className={cn("text-[10px] leading-3 tracking-[0.08em] uppercase", isToday ? "text-highlight-foreground/70" : "text-muted-foreground")}>{monthLabel.slice(0, 3)}</span>
            <span className="tabular text-[15px] leading-5 font-semibold">{day}</span>
            <span className="flex h-1.5 items-center gap-0.5">
              {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                <span key={k} data-dot className={cn("size-1.5 rounded-full", isToday ? "bg-highlight-foreground" : "bg-foreground")} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
