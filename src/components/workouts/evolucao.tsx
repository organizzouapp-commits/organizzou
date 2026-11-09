"use client"

import { useId, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, FlameIcon, MinusIcon, TrendingDownIcon, TrendingUpIcon, TrophyIcon, WeightIcon } from "lucide-react"

import { BentoCard, BentoStat, SegmentedPills } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HeroCard, StatusChip } from "@/components/finance/parts"
import { HATCH_STYLE } from "@/components/habits/hoje-tab"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  EVOLUTION_PERIODS,
  averagePerWeek,
  isNewRecord,
  loadSeries,
  loadSummary,
  niceAxis,
  periodWeeks,
  plannedPerWeek,
  recordGain,
  recordRows,
  recordsInMonth,
  sessionsInPeriod,
  volumeDelta,
  weeklyBuckets,
  type LoadPoint,
  type PeriodId,
  type WeekBucket,
} from "@/features/workouts/evolution"
import type { ExerciseRow, SetLogRow, WorkoutPlanRow, WorkoutSessionRow } from "@/features/workouts/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const dim = (text: string) => <span className="opacity-50">{text}</span>
const kg = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`
const tons = (value: number) => (value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })

export function PeriodSwitch({ value, onChange, className }: { value: PeriodId; onChange: (id: PeriodId) => void; className?: string }) {
  return <SegmentedPills items={EVOLUTION_PERIODS.map((p) => ({ id: p.id, label: p.label }))} value={value} onChange={onChange} ariaLabel="Período" className={className} />
}

type Data = { sets: SetLogRow[]; sessions: WorkoutSessionRow[]; plans: WorkoutPlanRow[]; exercises: ExerciseRow[]; today: string }

// ------------------------------------------------------------------ top cards

function TopCards({ sets, sessions, plans, today, period, isMobile }: Data & { period: PeriodId; isMobile: boolean }) {
  const weeks = periodWeeks(period)
  const long = EVOLUTION_PERIODS.find((p) => p.id === period)!.long
  const done = sessionsInPeriod(sessions, today, weeks).length
  const perWeek = plannedPerWeek(plans)
  const goal = perWeek * weeks
  // The last bucket is always the current week (weeks before the first workout are dropped).
  const twoWeeks = weeklyBuckets(sets, sessions, today, 2)
  const current = twoWeeks.at(-1)?.volume ?? 0
  const delta = volumeDelta(twoWeeks)
  const records = recordRows(sets, sessions)
  const month = format(parseISO(today), "MMM", { locale: ptBR }).replace(".", "")
  const average = averagePerWeek(done, weeks)

  const hero = <HeroCard key="hero" className="h-44" density="dense" label={`Treinos em ${long}`} value={done} support={goal > 0 ? `sessões concluídas · meta: ${goal}` : "sessões concluídas · sem meta"} progress={{ value: goal > 0 ? Math.min(100, (done / goal) * 100) : 0, label: `Treinos em ${long}` }} />
  const volume = (
    <BentoStat key="volume" label="Volume da semana" icon={WeightIcon} className="h-44" chip={delta === null ? "sem semana anterior" : delta === 0 ? "igual à semana anterior" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}% vs. semana anterior`} chipIcon={delta === null ? MinusIcon : delta >= 0 ? TrendingUpIcon : TrendingDownIcon}>
      {tons(current)}
      {dim(" t")}
    </BentoStat>
  )
  const recordsCard = (
    <BentoStat key="records" label="Recordes" icon={TrophyIcon} className="h-44" chip={`${recordsInMonth(records, today)} novos em ${month}`}>
      {records.length}
    </BentoStat>
  )
  const frequency = (
    <BentoStat key="freq" label="Frequência" icon={FlameIcon} className="h-44" chip={perWeek > 0 ? `meta: ${perWeek}/sem` : "sem meta semanal"}>
      {average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      {dim("/sem")}
    </BentoStat>
  )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo da evolução"
        noun="resumo"
        initialHeight={176}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "volume", node: volume },
          { id: "records", node: recordsCard },
          { id: "freq", node: frequency },
        ]}
      />
    )
  }
  return (
    <div data-testid="evolution-top" className="grid grid-cols-2 gap-4 @min-[1000px]:grid-cols-4">
      {[hero, volume, recordsCard, frequency].map((card, i) => (
        <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
          {card}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ load per workout

const AXIS = 56

function LoadChart({ points, isMobile }: { points: LoadPoint[]; isMobile: boolean }) {
  const gradient = useId()
  const [tip, setTip] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  if (points.length === 0) return <p className="py-10 text-center text-[13px] leading-5 text-muted-foreground">Nenhum registro deste exercício no período.</p>
  const axis = niceAxis(points.map((p) => p.load), { max: 5 })
  const n = points.length
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const y = (load: number) => ((axis.max - load) / (axis.max - axis.min)) * 100
  const line = points.map((p, i) => `${x(i).toFixed(2)},${y(p.load).toFixed(2)}`).join(" ")
  const show = (day: string) => {
    setTip(day)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setTip((c) => (c === day ? null : c)), 3500)
  }
  const tipIndex = points.findIndex((p) => p.day === tip)
  const labelEvery = Math.ceil(n / (isMobile ? 5 : 8))
  const summary = `Carga por treino: ${points.map((p) => `${format(parseISO(p.day), "d/M")} ${kg(p.load)} × ${p.reps}`).join(", ")}.`
  return (
    <div role="group" aria-label={summary} data-testid="load-chart" className="relative h-[220px]" onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-3 bottom-7">
        {axis.ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ top: `${y(t)}%`, transform: "translateY(-50%)" }}>
            <span className="tabular w-12 shrink-0 text-right text-[11px] leading-4 whitespace-nowrap text-muted-foreground">{t.toLocaleString("pt-BR")} kg</span>
            <span className="flex-1 border-t border-dashed border-foreground/20" />
          </div>
        ))}
      </div>
      <div className="absolute top-3 right-4 bottom-7" style={{ left: AXIS + 8 }}>
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {n > 1 ? <polygon points={`${x(0)},100 ${line} ${x(n - 1)},100`} fill={`url(#${gradient})`} /> : null}
          {n > 1 ? <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        {points.map((p, i) => {
          const last = i === n - 1
          return (
            <button
              key={p.day}
              type="button"
              data-point={p.day}
              aria-label={`${format(parseISO(p.day), "d 'de' MMMM", { locale: ptBR })}: ${kg(p.load)} × ${p.reps}`}
              onClick={() => show(p.day)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setTip(p.day)}
              onFocus={() => setTip(p.day)}
              onBlur={() => setTip(null)}
              className="absolute flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none after:absolute after:-inset-3 focus-visible:ring-3 focus-visible:ring-ring/50"
              style={{ left: `${x(i)}%`, top: `${y(p.load)}%` }}
            >
              <span className={cn("size-3 rounded-full border-2 border-primary", last ? "bg-primary" : "bg-card")} />
            </button>
          )
        })}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <span key={p.day} aria-hidden className={cn("tabular absolute top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-muted-foreground", isMobile ? "text-[10px] leading-4" : "text-[12px] leading-5")} style={{ left: `${x(i)}%` }}>
              {format(parseISO(p.day), isMobile ? "d/M" : "dd/MM")}
            </span>
          ) : null
        )}
        {tipIndex >= 0 ? (
          <div data-testid="load-tip" role="status" className="pointer-events-none absolute z-20 w-36 -translate-x-1/2 -translate-y-full rounded-[12px] border border-border bg-popover px-3 py-2 text-popover-foreground" style={{ left: `clamp(72px, ${x(tipIndex)}%, calc(100% - 72px))`, top: `calc(${y(points[tipIndex].load)}% - 14px)` }}>
            <p className="text-[12px] leading-5 text-muted-foreground">{format(parseISO(points[tipIndex].day), "d 'de' MMM", { locale: ptBR })}</p>
            <p className="tabular text-[13px] leading-5 font-semibold">
              {kg(points[tipIndex].load)} × {points[tipIndex].reps}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LoadCard({ sets, sessions, exercises, today, period, exerciseId, onExercise, isMobile }: Data & { period: PeriodId; exerciseId: string; onExercise: (id: string) => void; isMobile: boolean }) {
  const points = loadSeries(exerciseId, sets, sessions, today, periodWeeks(period))
  const known = new Set(sets.map((s) => s.exercise_id))
  const choices = exercises.filter((e) => known.has(e.id) || e.id === exerciseId)
  const current = exercises.find((e) => e.id === exerciseId)
  return (
    <BentoCard
      title="Carga por treino"
      subtitle={loadSummary(points)}
      data-testid="evolution-load"
      className="h-full"
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" data-testid="load-exercise" aria-label={`Exercício: ${current?.name ?? "escolher"}`} className="relative inline-flex h-9 max-w-44 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] leading-5 outline-none transition-colors duration-[400ms] after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:max-w-56">
              <span className="truncate">{current?.name ?? "Exercício"}</span>
              <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 min-w-56">
            {choices.map((e) => (
              <DropdownMenuItem key={e.id} onSelect={() => onExercise(e.id)}>
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                {e.id === exerciseId ? <CheckIcon aria-hidden strokeWidth={1.75} /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <LoadChart points={points} isMobile={isMobile} />
    </BentoCard>
  )
}

// ------------------------------------------------------------------ volume per week

function VolumeCard({ sets, sessions, today, period, isMobile }: Data & { period: PeriodId; isMobile: boolean }) {
  const buckets: WeekBucket[] = weeklyBuckets(sets, sessions, today, periodWeeks(period))
  const values = buckets.map((b) => b.volume / 1000)
  const average = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
  const axis = niceAxis(values.length ? values : [1], { zero: true, max: 4 })
  const pct = (v: number) => (v / axis.max) * 100
  const many = buckets.length > 13
  const labelEvery = Math.ceil(buckets.length / (isMobile ? 6 : 9))
  const summary = `Volume por semana: ${buckets.map((b) => `${b.label} ${tons(b.volume)} t`).join(", ")}.`
  return (
    <BentoCard title="Volume por semana" subtitle="Carga × reps de todas as séries" data-testid="evolution-volume" className="h-full" actions={<span data-chip className={chip}>média {average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t</span>}>
      {buckets.length === 0 ? (
        <p className="py-10 text-center text-[13px] leading-5 text-muted-foreground">Sem treinos concluídos no período.</p>
      ) : (
        <div role="img" aria-label={summary} className="relative h-[220px]">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 bottom-6">
            {axis.ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${pct(t)}%`, transform: "translateY(50%)" }}>
                <span className="tabular w-8 shrink-0 text-right text-[11px] leading-4 whitespace-nowrap text-muted-foreground">{t === 0 ? "0" : `${t.toLocaleString("pt-BR")} t`}</span>
                <span className={cn("flex-1 border-t", t === 0 ? "border-foreground/35" : "border-dashed border-foreground/20")} />
              </div>
            ))}
            <div data-testid="volume-average-line" className="absolute right-0 border-t-2 border-dashed border-primary" style={{ left: 40, bottom: `${pct(average)}%` }} />
          </div>
          <div className="absolute inset-y-0 right-0 flex" style={{ left: 40 }}>
            {buckets.map((b, i) => {
              const current = i === buckets.length - 1
              const value = b.volume / 1000
              return (
                <div key={b.start} data-week={b.start} className="relative h-full min-w-0 flex-1">
                  <div className="absolute inset-x-0 top-6 bottom-6 flex justify-center">
                    <div className="relative w-[56%] max-w-8">
                      {value > 0 ? <span data-bar={current ? "current" : "past"} className={cn("absolute inset-x-0 bottom-0 rounded-full", current ? "bg-primary" : "border border-foreground/20")} style={{ height: `max(${pct(value)}%, 14px)`, ...(current ? {} : HATCH_STYLE) }} /> : null}
                      {!many || current ? (
                        <span className="tabular absolute left-1/2 z-10 -translate-x-1/2 rounded bg-card px-0.5 text-[11px] leading-4 font-semibold" style={{ bottom: `calc(max(${pct(value)}%, ${value > 0 ? 14 : 0}px) + 4px)` }}>
                          {tons(b.volume)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {i % labelEvery === 0 || current ? (
                    <span aria-hidden className={cn("tabular absolute inset-x-0 bottom-0 h-6 pt-1 text-center whitespace-nowrap", isMobile ? "text-[10px] leading-5" : "text-[12px] leading-5", current ? "font-bold" : "text-muted-foreground")}>
                      {format(parseISO(b.start), isMobile ? "d/M" : "dd/MM")}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </BentoCard>
  )
}

// ------------------------------------------------------------------ records

function RecordsCard({ sets, sessions, exercises, today }: Data) {
  const rows = recordRows(sets, sessions)
  const name = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercício"
  return (
    <BentoCard title="Recordes pessoais" data-testid="evolution-records" actions={<span data-chip className={chip}>{rows.length} no total</span>}>
      {rows.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Os recordes aparecem aqui depois do primeiro treino concluído.</p> : null}
      <ul className="grid gap-x-8 @min-[900px]:grid-cols-2">
        {rows.map((row) => {
          const gain = recordGain(row)
          return (
            <li key={row.exerciseId} data-record={row.exerciseId} className="flex min-h-14 items-center gap-3 border-b border-border py-3 last:border-b-0 @min-[900px]:nth-last-2:border-b-0">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
                <TrophyIcon strokeWidth={1.75} className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14px] leading-5 font-semibold @min-[900px]:truncate">{name(row.exerciseId)}</p>
                <p className="text-[13px] leading-5 text-muted-foreground">{format(parseISO(row.on), "d 'de' MMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 @min-[900px]:flex-row @min-[900px]:items-center @min-[900px]:gap-3">
                <span className="tabular text-[14px] leading-5 font-semibold">
                  {kg(row.loadKg)} × {row.reps}
                </span>
                {isNewRecord(row, today) ? (
                  <span data-chip="new" className="inline-flex h-6 items-center rounded-full bg-highlight px-2 text-[12px] leading-4 font-semibold text-highlight-foreground">
                    novo
                  </span>
                ) : gain ? (
                  <StatusChip icon={ArrowUpIcon}>{gain}</StatusChip>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ the tab

export function EvolucaoTab({ sets, sessions, plans, exercises, today, period, exerciseId, onExercise, isMobile }: Data & { period: PeriodId; exerciseId: string; onExercise: (id: string) => void; isMobile: boolean }) {
  const data = { sets, sessions, plans, exercises, today }
  return (
    <div data-testid="evolucao" className="@container flex min-w-0 flex-col gap-4">
      <TopCards {...data} period={period} isMobile={isMobile} />
      <div className="grid min-w-0 grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <div className="min-w-0 @min-[880px]:col-span-7">
          <LoadCard {...data} period={period} exerciseId={exerciseId} onExercise={onExercise} isMobile={isMobile} />
        </div>
        <div className="min-w-0 @min-[880px]:col-span-5">
          <VolumeCard {...data} period={period} isMobile={isMobile} />
        </div>
      </div>
      <RecordsCard {...data} />
    </div>
  )
}

