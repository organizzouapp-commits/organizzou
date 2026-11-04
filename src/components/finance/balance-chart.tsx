"use client"

import { useId, useRef, useState, type CSSProperties } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import type { BalanceMonth } from "@/features/finance/history"
import { formatBalance } from "@/lib/money"
import { cn } from "@/lib/utils"

import { MoneyText } from "./parts"

const INK = "var(--highlight-foreground)"
const TONES = [1, 0.7, 0.45, 0.25]

/** One account's look on the Lima card: Tinta at 100 / 70 / 45 / 25%, then a hatch for the fifth and beyond. Works in both themes. */
export function toneStyle(rank: number): CSSProperties {
  if (rank < TONES.length) return { backgroundColor: `color-mix(in oklab, ${INK} ${TONES[rank] * 100}%, transparent)` }
  return { backgroundColor: `color-mix(in oklab, ${INK} 12%, transparent)`, backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${INK} 60%, transparent) 0 2px, transparent 2px 5px)` }
}

const monthName = (key: string, pattern: string) => format(parseISO(`${key}-01`), pattern, { locale: ptBR }).replace(".", "")

/**
 * The evolution of the total balance and where it comes from: one stacked column per month (an account per segment; negative balances hang
 * below the baseline) with the total as a Tinta line and a dot per month, over a Lima card. A month is chosen by hover, tap or the arrow
 * keys and drives the tooltip and the legend; picking a legend item isolates that account across the months (again to undo).
 */
export function BalanceChart({ history, className }: { history: BalanceMonth[]; className?: string }) {
  const gradient = useId()
  const [picked, setPicked] = useState<string | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [isolate, setIsolate] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const last = history[history.length - 1]
  const selected = history.find((m) => m.month === picked) ?? last
  if (!last || !selected) return null

  // Colors stay with an account: rank them by size in the latest month, then by the biggest they ever were.
  const ranking = [...last.parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map((p) => p.id)
  const rank = (id: string) => ranking.indexOf(id)
  const enough = history.length >= 2

  const stackOf = (m: BalanceMonth) => {
    const parts = [...m.parts].sort((a, b) => rank(a.id) - rank(b.id))
    return { up: parts.filter((p) => p.value > 0), down: parts.filter((p) => p.value < 0) }
  }
  const up = (m: BalanceMonth) => m.parts.filter((p) => p.value > 0).reduce((s, p) => s + p.value, 0)
  const down = (m: BalanceMonth) => -m.parts.filter((p) => p.value < 0).reduce((s, p) => s + p.value, 0)
  const top = Math.max(1, ...history.map((m) => Math.max(up(m), m.total))) * 1.08
  const bottom = -Math.max(0, ...history.map((m) => Math.max(down(m), -m.total))) * 1.08
  const range = top - bottom
  const at = (v: number) => ((v - bottom) / range) * 100
  const zero = at(0)
  const n = history.length
  const xs = history.map((_, i) => ((i + 0.5) / n) * 100)
  const line = history.map((m, i) => `${xs[i].toFixed(2)},${(100 - at(m.total)).toFixed(2)}`).join(" ")

  const select = (key: string) => {
    setPicked(key)
    setTip(key)
    window.clearTimeout(timer.current)
    // A tap has no "leave": the tooltip fades after a moment.
    timer.current = window.setTimeout(() => setTip((current) => (current === key ? null : current)), 3500)
  }
  const tipMonth = history.find((m) => m.month === tip)
  const summary = `Saldo total em ${monthName(selected.month, "MMMM")}: ${formatBalance(selected.total)}, composto por ${selected.parts.map((p) => `${p.name} ${formatBalance(p.value)}`).join(", ")}. Use as setas para trocar de mês.`
  const faded = (id: string): CSSProperties => (isolate && isolate !== id ? { opacity: 0.18 } : {})

  return (
    <div data-testid="balance-chart" className={cn("@container flex flex-col gap-3", className)}>
      {enough ? (
        <div role="group" aria-label={summary} data-testid="balance-plot" className="relative h-[132px] md:h-[150px]" onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-5 z-10">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={INK} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={INK} stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" x2="100" y1={100 - zero} y2={100 - zero} stroke={INK} strokeOpacity="0.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <polygon points={`${xs[0]},${100 - zero} ${line} ${xs[n - 1]},${100 - zero}`} fill={`url(#${gradient})`} />
              <polyline points={line} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {history.map((m, i) => (
              <span key={m.month} data-total-dot={m.month} className={cn("absolute rounded-full bg-highlight-foreground ring-2 ring-highlight transition-[width,height] duration-[400ms] motion-reduce:transition-none", m.month === selected.month ? "size-3" : "size-2")} style={{ left: `${xs[i]}%`, top: `${100 - at(m.total)}%`, transform: "translate(-50%, -50%)" }} />
            ))}
          </div>
          <div className="absolute inset-0 flex">
            {history.map((m, i) => {
              const on = m.month === selected.month
              const { up: ups, down: downs } = stackOf(m)
              let climbed = 0
              let sunk = 0
              return (
                <button
                  key={m.month}
                  type="button"
                  aria-pressed={on}
                  data-month={m.month}
                  aria-label={`${monthName(m.month, "MMMM")}: saldo total ${formatBalance(m.total)}`}
                  onClick={() => select(m.month)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") {
                      setPicked(m.month)
                      setTip(m.month)
                    }
                  }}
                  onFocus={() => setTip(m.month)}
                  onBlur={() => setTip(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") return setTip(null)
                    const next = e.key === "ArrowRight" ? Math.min(n - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null
                    if (next === null) return
                    e.preventDefault()
                    select(history[next].month)
                    ;(e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus()
                  }}
                  className="relative h-full min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-highlight-foreground/40"
                >
                  <span className={cn("absolute inset-x-[20%] top-0 bottom-5 transition-opacity duration-[400ms] motion-reduce:transition-none md:inset-x-[24%]", on ? "opacity-100" : "opacity-60")}>
                    {ups.map((p, k) => {
                      const from = at(climbed)
                      climbed += p.value
                      const height = at(climbed) - from
                      return <span key={p.id} data-segment={p.id} className={cn("absolute inset-x-0", k === ups.length - 1 && "rounded-t-[6px]")} style={{ bottom: `${from}%`, height: `calc(${height}% - 1px)`, ...toneStyle(rank(p.id)), ...faded(p.id) }} />
                    })}
                    {downs.map((p, k) => {
                      const from = at(-sunk)
                      sunk += -p.value
                      const height = from - at(-sunk)
                      return <span key={p.id} data-segment={p.id} data-negative className={cn("absolute inset-x-0", k === downs.length - 1 && "rounded-b-[6px]")} style={{ bottom: `${at(-sunk)}%`, height: `calc(${height}% - 1px)`, ...toneStyle(rank(p.id)), ...faded(p.id) }} />
                    })}
                  </span>
                  <span className={cn("absolute inset-x-0 bottom-0 h-5 text-center text-[12px] leading-5 capitalize", on ? "font-bold" : "text-highlight-foreground/60")}>{monthName(m.month, "MMM")}</span>
                </button>
              )
            })}
          </div>
          {tipMonth ? (
            <div data-testid="balance-tooltip" role="status" className="pointer-events-none absolute top-0 z-20 w-[210px] -translate-x-1/2 rounded-[12px] bg-palette-tinta px-3 py-2 text-palette-lima" style={{ left: `clamp(105px, ${((history.findIndex((m) => m.month === tipMonth.month) + 0.5) / n) * 100}%, calc(100% - 105px))` }}>
              <div className="flex items-baseline justify-between gap-2 text-[12px] leading-5 font-semibold">
                <span className="capitalize">{monthName(tipMonth.month, "MMMM")}</span>
                <MoneyText cents={tipMonth.total} tone="value" />
              </div>
              {[...tipMonth.parts].sort((a, b) => rank(a.id) - rank(b.id)).map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-[11px] leading-4">
                  <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-palette-lima" style={{ opacity: rank(p.id) < 4 ? Math.max(0.3, TONES[rank(p.id)]) : 0.3 }} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <MoneyText cents={p.value} tone="value" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p data-testid="balance-empty" className="text-[13px] leading-5 text-highlight-foreground/70">
          Sem histórico suficiente ainda
        </p>
      )}

      <div className="flex items-baseline justify-between gap-3 border-t border-highlight-foreground/15 pt-2 text-[12px] leading-4 text-highlight-foreground/75">
        <span data-testid="balance-legend-month">
          De onde vem · {monthName(selected.month, "MMMM")}
        </span>
        <MoneyText cents={selected.total} tone="value" className="font-semibold text-highlight-foreground" />
      </div>
      <ul data-testid="balance-legend" className="grid grid-cols-1 gap-x-5 gap-y-0.5 @[300px]:grid-cols-2">
        {[...selected.parts].sort((a, b) => rank(a.id) - rank(b.id)).map((p) => {
          const pressed = isolate === p.id
          return (
            <li key={p.id}>
              <button type="button" aria-pressed={pressed} data-legend-account={p.id} onClick={() => setIsolate(pressed ? null : p.id)} className={cn("relative grid h-8 w-full grid-cols-[10px_minmax(0,1fr)_auto_34px] items-center gap-2 rounded-lg text-left text-[13px] leading-5 outline-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-highlight-foreground/40", pressed && "bg-highlight-foreground/10 font-semibold", isolate && !pressed && "opacity-60")}>
                <span aria-hidden className="size-2.5 rounded-[3px]" style={toneStyle(rank(p.id))} />
                <span className="truncate">{p.name}</span>
                <MoneyText cents={p.value} tone="value" className="text-right" />
                <span className="tabular text-right text-[12px] text-highlight-foreground/70">{p.value > 0 && selected.total > 0 ? `${Math.round((p.value / selected.total) * 100)}%` : ""}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
