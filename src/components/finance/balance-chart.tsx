"use client"

import { useRef, useState, type CSSProperties } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import type { BalanceMonth } from "@/features/finance/history"
import { formatBalance } from "@/lib/money"
import { cn } from "@/lib/utils"

import { niceAxis, tickLabel } from "./bento"
import { MoneyText } from "./parts"

const INK = "currentColor"
const TONES = [1, 0.7, 0.45, 0.25]
const AXIS = 44

/** One account's look on the Lima card: Tinta at 100 / 70 / 45 / 25%, then a hatch for the fifth and beyond. Works in both themes. */
export function toneStyle(rank: number): CSSProperties {
  if (rank < TONES.length) return { backgroundColor: `color-mix(in oklab, ${INK} ${TONES[rank] * 100}%, transparent)` }
  return { backgroundColor: `color-mix(in oklab, ${INK} 12%, transparent)`, backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${INK} 60%, transparent) 0 2px, transparent 2px 5px)` }
}

/** The hatch of the months that are not selected (Tinta on Lima), the same rhythm as the Fluxo de caixa columns. */
const HATCH: CSSProperties = {
  backgroundColor: `color-mix(in oklab, ${INK} 8%, transparent)`,
  backgroundImage: `repeating-linear-gradient(135deg, color-mix(in oklab, ${INK} 45%, transparent) 0 1.5px, transparent 1.5px 5px)`,
}

const monthName = (key: string, pattern: string) => format(parseISO(`${key}-01`), pattern, { locale: ptBR }).replace(".", "")

/**
 * The evolution of the total balance and where it comes from, in the language of the Fluxo de caixa chart: a pill column per month over
 * dashed grid lines with a y axis. Months that are not selected are hatched; the selected one is solid and stacked by account in Tinta tones
 * (a negative balance hangs below the baseline). A month is chosen by hover, tap or the arrow keys and drives the tooltip and the legend;
 * picking a legend item highlights that account (again to undo).
 */
export function BalanceChart({ history, className }: { history: BalanceMonth[]; className?: string }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [isolate, setIsolate] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const last = history[history.length - 1]
  const selected = history.find((m) => m.month === picked) ?? last
  if (!last || !selected) return null

  // Colors stay with an account: rank them by size in the latest month.
  const ranking = [...last.parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map((p) => p.id)
  const rank = (id: string) => ranking.indexOf(id)
  const enough = history.length >= 2

  const up = (m: BalanceMonth) => m.parts.filter((p) => p.value > 0).reduce((s, p) => s + p.value, 0)
  const down = (m: BalanceMonth) => -m.parts.filter((p) => p.value < 0).reduce((s, p) => s + p.value, 0)
  const topValue = Math.max(1, ...history.map(up))
  const bottomValue = Math.max(0, ...history.map(down))
  const { step } = niceAxis(Math.max(topValue, bottomValue * 2.5))
  const hi = Math.max(1, Math.ceil(topValue / step))
  const lo = bottomValue > 0 ? -Math.ceil(bottomValue / step) : 0
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  const min = lo * step
  const range = (hi - lo) * step
  const at = (v: number) => ((v - min) / range) * 100
  const n = history.length

  const select = (key: string) => {
    setPicked(key)
    setTip(key)
    window.clearTimeout(timer.current)
    // A tap has no "leave": the tooltip fades after a moment.
    timer.current = window.setTimeout(() => setTip((current) => (current === key ? null : current)), 3500)
  }
  const tipMonth = history.find((m) => m.month === tip)
  const summary = `Saldo total em ${monthName(selected.month, "MMMM")}: ${formatBalance(selected.total)}, composto por ${selected.parts.map((p) => `${p.name} ${formatBalance(p.value)}`).join(", ")}. Use as setas para trocar de mês.`
  const faded = (id: string): CSSProperties => (isolate && isolate !== id ? { opacity: 0.2 } : {})
  const sorted = (m: BalanceMonth) => [...m.parts].sort((a, b) => rank(a.id) - rank(b.id))

  return (
    <div data-testid="balance-chart" className={cn("@container flex flex-col gap-3", className)}>
      {enough ? (
        <div role="group" aria-label={summary} data-testid="balance-plot" className="relative h-[150px] md:h-[170px]" onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-2 bottom-6">
            {ticks.map((t) => (
              <div key={t} data-tick className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${at(t * step)}%`, transform: "translateY(50%)" }}>
                <span className="tabular w-9 shrink-0 text-right text-[11px] leading-4 whitespace-nowrap text-current/60">{t === 0 ? "0" : `${t < 0 ? "−" : ""}${tickLabel(Math.abs(t) * step)}`}</span>
                <span className={cn("flex-1 border-t", t === 0 ? "border-current/35" : "border-dashed border-current/20")} />
              </div>
            ))}
          </div>
          <div className="absolute inset-y-0 right-0 flex" style={{ left: AXIS }}>
            {history.map((m, i) => {
              const on = m.month === selected.month
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
                  className="relative h-full min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-current/40"
                >
                  <span className="absolute inset-x-0 top-2 bottom-6 flex justify-center">
                    <span className="relative w-[46%] max-w-9">
                      {on ? (
                        <>
                          {sorted(m).filter((p) => p.value > 0).map((p, k, list) => {
                            const from = at(climbed)
                            climbed += p.value
                            return <span key={p.id} data-segment={p.id} className={cn("absolute inset-x-0", k === list.length - 1 && "rounded-t-md")} style={{ bottom: `${from}%`, height: `calc(${at(climbed) - from}% - 1px)`, ...toneStyle(rank(p.id)), ...faded(p.id) }} />
                          })}
                          {sorted(m).filter((p) => p.value < 0).map((p, k, list) => {
                            const from = at(-sunk)
                            sunk += -p.value
                            return <span key={p.id} data-segment={p.id} data-negative className={cn("absolute inset-x-0", k === list.length - 1 && "rounded-b-md")} style={{ bottom: `${at(-sunk)}%`, height: `calc(${from - at(-sunk)}% - 1px)`, ...toneStyle(rank(p.id)), ...faded(p.id) }} />
                          })}
                        </>
                      ) : (
                        <>
                          <span data-hatched className="absolute inset-x-0 rounded-t-md" style={{ bottom: `${at(0)}%`, height: `${at(up(m)) - at(0)}%`, ...HATCH }} />
                          {down(m) > 0 ? <span data-hatched className="absolute inset-x-0 rounded-b-md" style={{ bottom: `${at(-down(m))}%`, height: `${at(0) - at(-down(m))}%`, ...HATCH }} /> : null}
                        </>
                      )}
                    </span>
                  </span>
                  <span className={cn("absolute inset-x-0 bottom-0 h-6 pt-1 text-center text-[12px] leading-5 capitalize", on ? "font-bold" : "text-current/60")}>{monthName(m.month, "MMM")}</span>
                </button>
              )
            })}
          </div>
          {tipMonth ? (
            <div data-testid="balance-tooltip" role="status" className="pointer-events-none absolute top-0 z-20 w-[200px] -translate-x-1/2 rounded-[12px] border border-border bg-popover px-3 py-2 text-popover-foreground" style={{ left: `clamp(100px, calc(${AXIS}px + (100% - ${AXIS}px) * ${(history.findIndex((m) => m.month === tipMonth.month) + 0.5) / n}), calc(100% - 100px))` }}>
              <div className="flex items-center justify-between gap-2 text-[12px] leading-5 font-semibold">
                <span className="flex items-center gap-1.5 capitalize">
                  <span aria-hidden className="size-2 rounded-full bg-highlight" />
                  {monthName(tipMonth.month, "MMMM")}
                </span>
                <MoneyText cents={tipMonth.total} tone="value" />
              </div>
              {sorted(tipMonth).map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-[12px] leading-5">
                  <span aria-hidden className="relative size-2.5 shrink-0 overflow-hidden rounded-[3px] bg-highlight">
                    <span className="absolute inset-0" style={toneStyle(rank(p.id))} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.name}</span>
                  <MoneyText cents={p.value} tone="value" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p data-testid="balance-empty" className="text-[13px] leading-5 text-current/70">
          Sem histórico suficiente ainda
        </p>
      )}

      <div className="flex items-baseline justify-between gap-3 border-t border-current/15 pt-2 text-[12px] leading-4 text-current/75">
        <span data-testid="balance-legend-month">De onde vem · {monthName(selected.month, "MMMM")}</span>
        <MoneyText cents={selected.total} tone="value" className="font-semibold" />
      </div>
      <ul data-testid="balance-legend" className="grid grid-cols-1 gap-x-5 gap-y-0.5 @[300px]:grid-cols-2">
        {sorted(selected).map((p) => {
          const pressed = isolate === p.id
          return (
            <li key={p.id}>
              <button type="button" aria-pressed={pressed} data-legend-account={p.id} onClick={() => setIsolate(pressed ? null : p.id)} className={cn("relative grid h-8 w-full grid-cols-[10px_minmax(0,1fr)_auto_34px] items-center gap-2 rounded-lg text-left text-[13px] leading-5 outline-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-current/40", pressed && "bg-current/10 font-semibold", isolate && !pressed && "opacity-60")}>
                <span aria-hidden className="size-2.5 rounded-[3px]" style={toneStyle(rank(p.id))} />
                <span className="truncate">{p.name}</span>
                <MoneyText cents={p.value} tone="value" className="text-right" />
                <span className="tabular text-right text-[12px] text-current/70">{p.value > 0 && selected.total > 0 ? `${Math.round((p.value / selected.total) * 100)}%` : ""}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
