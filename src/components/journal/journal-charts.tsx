"use client"

import { useId, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import { BentoCard } from "@/components/finance/bento"
import { useElementSize } from "@/hooks/use-element-size"
import { formatMood, labelIndices, lineSegments, moodLabelStep, moodText, pickLabelSpot, sampleLine, sleepAxisMax, sleepText, spreadIndices, type Box, type DayPoint } from "@/features/journal/stats"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const HALO = { paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 4, strokeLinejoin: "round" } as const
/** Candidate x positions for a label of width `w` inside a plot: every ~40 px from the left edge to the right edge. */
const spots = (left: number, right: number, w: number) => {
  const out: number[] = []
  for (let x = left + 6; x + w <= right - 6; x += 10) out.push(x)
  out.push(Math.max(left + 6, right - 6 - w))
  return out
}
const dayLabel = (day: string, mobile: boolean) => format(parseISO(day), mobile ? "d/M" : "dd/MM")

// ------------------------------------------------------------------ mood

const M = { left: 30, right: 14, top: 14, bottom: 28 }

export function MoodChart({ points, average, period, mobile }: { points: DayPoint[]; average: number | null; period: number; mobile: boolean }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const gradient = useId()
  const [active, setActive] = useState<number | null>(null)
  const n = points.length
  const width = size.width
  const height = Math.max(mobile ? 210 : 230, size.height)
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = height - M.top - M.bottom
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (mood: number) => M.top + (1 - (mood - 1) / 4) * plotH
  const runs = lineSegments(points)
  const data = points.map((p, i) => ({ ...p, i })).filter((p): p is DayPoint & { i: number; mood: NonNullable<DayPoint["mood"]> } => p.mood !== null)
  const last = data[data.length - 1]
  const shown = active !== null ? data.find((p) => p.i === active) : undefined
  const tipW = 132
  const tipLeft = shown ? Math.min(Math.max(x(shown.i) - tipW / 2, M.left), Math.max(M.left, width - M.right - tipW)) : 0
  const tipTop = shown ? Math.max(0, y(shown.mood) - 62) : 0
  const labels = labelIndices(n, moodLabelStep(period))
  // The average label goes where the line is not: the first free spot from the left edge.
  const avgLabelW = 62
  const avgLabel = average === null ? { x: 0, side: "above" as const } : pickLabelSpot(spots(M.left, width - M.right, avgLabelW), avgLabelW, y(average), runs.flatMap((r) => sampleLine(r.map((p) => ({ x: x(p.index), y: y(p.mood) })))))
  const summary = `Humor nos últimos ${period} dias: ${data.length} ${data.length === 1 ? "registro" : "registros"}${average !== null ? `, média ${formatMood(average)}` : ""}.`

  return (
    <BentoCard title={`Humor nos últimos ${period} dias`} data-testid="mood-chart" className="h-full md:p-6" actions={average !== null ? <span data-chip className={chip}>média {formatMood(average)}</span> : undefined}>
      <div ref={ref} className={cn("relative w-full flex-1", mobile ? "h-[210px]" : "min-h-[230px]")}>
        {width > 0 ? (
          <>
            <svg
              role="img"
              aria-label={summary}
              width={width}
              height={height}
              className="block touch-pan-y overflow-visible"
              onPointerLeave={() => setActive(null)}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const px = e.clientX - rect.left
                const nearest = data.reduce<number | null>((best, p) => (best === null || Math.abs(x(p.i) - px) < Math.abs(x(best) - px) ? p.i : best), null)
                setActive(nearest)
              }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const px = e.clientX - rect.left
                setActive(data.reduce<number | null>((best, p) => (best === null || Math.abs(x(p.i) - px) < Math.abs(x(best) - px) ? p.i : best), null))
              }}
            >
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[1, 2, 3, 4, 5].map((t) => (
                <g key={t} data-tick={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--foreground)" strokeOpacity={t === 1 ? 0.35 : 0.2} strokeDasharray={t === 1 ? undefined : "3 4"} />
                  <text x={M.left - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)" className="tabular">
                    {t}
                  </text>
                </g>
              ))}
              {average !== null ? (
                <g data-testid="mood-average-line">
                  <line x1={M.left} x2={width - M.right} y1={y(average)} y2={y(average)} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="6 5" />
                  <text x={avgLabel.x} y={avgLabel.side === "above" ? y(average) - 6 : y(average) + 15} fontSize="11" fontWeight="600" fill="var(--foreground)" style={HALO}>
                    média {formatMood(average)}
                  </text>
                </g>
              ) : null}
              {runs.map((run) =>
                run.length >= 2 ? (
                  <g key={run[0].index}>
                    <path d={`${run.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.index).toFixed(1)},${y(p.mood).toFixed(1)}`).join(" ")} L${x(run[run.length - 1].index).toFixed(1)},${y(1).toFixed(1)} L${x(run[0].index).toFixed(1)},${y(1).toFixed(1)} Z`} fill={`url(#${gradient})`} />
                    <path data-segment d={run.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.index).toFixed(1)},${y(p.mood).toFixed(1)}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  </g>
                ) : null
              )}
              {data.map((p) => {
                const isLast = p === last
                if (!isLast && data.length > 45) return null
                return <circle key={p.day} data-point={isLast ? "last" : "past"} cx={x(p.i)} cy={y(p.mood)} r={isLast ? 5.5 : 3.5} fill={isLast ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth="2" />
              })}
              {shown ? <circle cx={x(shown.i)} cy={y(shown.mood)} r={5.5} fill="var(--primary)" stroke="var(--card)" strokeWidth="2" /> : null}
              {labels.map((i) => (
                <text key={i} aria-hidden x={x(i)} y={height - 8} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize={mobile ? 10 : 12} fill="var(--muted-foreground)" fontWeight={i === n - 1 ? 700 : 400} className="tabular">
                  {dayLabel(points[i].day, mobile)}
                </text>
              ))}
            </svg>
            {shown ? (
              <div data-testid="mood-tooltip" className="pointer-events-none absolute z-10 flex flex-col rounded-[12px] border border-border bg-popover px-3 py-1.5 text-popover-foreground" style={{ left: tipLeft, top: tipTop, width: tipW }}>
                <span className="text-[11px] leading-4 text-muted-foreground">{format(parseISO(shown.day), "EEE, d MMM", { locale: ptBR }).replace(".", "")}</span>
                <span className="tabular text-[13px] leading-5 font-semibold">Humor: {moodText(shown.mood)}</span>
              </div>
            ) : null}
            <div className="sr-only">
            <table>
              <caption>{summary}</caption>
              <tbody>
                {data.map((p) => (
                  <tr key={p.day}>
                    <th scope="row">{format(parseISO(p.day), "d 'de' MMMM", { locale: ptBR })}</th>
                    <td>{moodText(p.mood)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        ) : null}
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ sleep

const S = { left: 30, right: 10, top: 14, bottom: 28 }

export function SleepChart({ points, average, goal, mobile }: { points: DayPoint[]; average: number | null; goal: number; mobile: boolean }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const hatch = useId()
  const n = points.length
  const width = size.width
  const height = Math.max(mobile ? 210 : 230, size.height)
  const plotW = Math.max(0, width - S.left - S.right)
  const plotH = height - S.top - S.bottom
  const max = sleepAxisMax([...points.map((p) => p.sleep), goal])
  const y = (h: number) => S.top + (1 - h / max) * plotH
  const slot = n > 0 ? plotW / n : 0
  const barW = Math.max(3, Math.min(24, slot * 0.56))
  const ticks = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5)
  const labels = spreadIndices(n)
  const bars: Box[] = points.flatMap((p, i) => (p.sleep === null ? [] : [{ x1: S.left + slot * (i + 0.5) - barW / 2, x2: S.left + slot * (i + 0.5) + barW / 2, y1: y(p.sleep), y2: y(0) }]))
  const goalLabelW = 78
  const goalLabel = pickLabelSpot(spots(S.left, width - S.right, goalLabelW), goalLabelW, y(goal), bars)
  const summary = `Horas de sono: ${points.filter((p) => p.sleep !== null).length} noites registradas${average !== null ? `, média ${sleepText(average)}` : ""}, meta ${sleepText(goal)}.`

  return (
    <BentoCard title="Horas de sono" data-testid="sleep-chart" className="h-full md:p-6" actions={average !== null ? <span data-chip className={chip}>média {sleepText(average)}</span> : undefined}>
      <div ref={ref} className={cn("relative w-full flex-1", mobile ? "h-[210px]" : "min-h-[230px]")}>
        {width > 0 ? (
          <>
            <svg role="img" aria-label={summary} width={width} height={height} className="block overflow-visible">
              <defs>
                <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--foreground)" strokeOpacity="0.3" strokeWidth="1.5" />
                </pattern>
              </defs>
              {ticks.map((t) => (
                <g key={t} data-tick={t}>
                  <line x1={S.left} x2={width - S.right} y1={y(t)} y2={y(t)} stroke="var(--foreground)" strokeOpacity={t === 0 ? 0.35 : 0.2} strokeDasharray={t === 0 ? undefined : "3 4"} />
                  <text x={S.left - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)" className="tabular">
                    {t}
                  </text>
                </g>
              ))}
              {points.map((p, i) => {
                if (p.sleep === null) return null
                const today = i === n - 1
                const h = Math.max(6, y(0) - y(p.sleep))
                const cx = S.left + slot * (i + 0.5)
                return <rect key={p.day} data-bar={today ? "today" : "past"} x={cx - barW / 2} y={y(0) - h} width={barW} height={h} rx={barW / 2} fill={today ? "var(--primary)" : `url(#${hatch})`} stroke={today ? "none" : "var(--foreground)"} strokeOpacity={0.2} />
              })}
              <g data-testid="sleep-goal-line">
                <line x1={S.left} x2={width - S.right} y1={y(goal)} y2={y(goal)} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="6 5" />
                <text x={goalLabel.x} y={goalLabel.side === "above" ? y(goal) - 6 : y(goal) + 15} fontSize="11" fontWeight="600" fill="var(--foreground)" style={HALO}>
                  meta {sleepText(goal)}
                </text>
              </g>
              {labels.map((i) => (
                <text key={i} aria-hidden x={S.left + slot * (i + 0.5)} y={height - 8} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize={mobile ? 10 : 12} fill="var(--muted-foreground)" fontWeight={i === n - 1 ? 700 : 400} className="tabular">
                  {dayLabel(points[i].day, mobile)}
                </text>
              ))}
            </svg>
            <div className="sr-only">
            <table>
              <caption>{summary}</caption>
              <tbody>
                {points
                  .filter((p) => p.sleep !== null)
                  .map((p) => (
                    <tr key={p.day}>
                      <th scope="row">{format(parseISO(p.day), "d 'de' MMMM", { locale: ptBR })}</th>
                      <td>{sleepText(p.sleep as number)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </>
        ) : null}
      </div>
    </BentoCard>
  )
}
