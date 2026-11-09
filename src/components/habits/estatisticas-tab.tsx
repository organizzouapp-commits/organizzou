"use client"

import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowDownIcon, ArrowUpIcon, CalendarDaysIcon, CheckCheckIcon, FlameIcon, MinusIcon, PauseIcon, SparklesIcon, TargetIcon, TrendingUpIcon, type LucideIcon } from "lucide-react"

import { BentoCard, BentoStat, SegmentedPills } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { HatchedProgress, HeroCard, StatusChip } from "@/components/finance/parts"
import { HATCH_STYLE, HabitGlyph } from "@/components/habits/hoje-tab"
import { Button } from "@/components/ui/button"
import {
  PERIODS,
  bestAndWorstWeekday,
  bestStreakOf,
  habitStats,
  insightsFor,
  monthCheckins,
  overallConsistency,
  weekdayStats,
  weeklyRates,
  weeksFor,
  type HabitStat,
  type Insight,
  type Period,
  type WeekRate,
} from "@/features/habits/stats"
import type { HabitLogRow, HabitRow } from "@/features/habits/types"
import { cn } from "@/lib/utils"

const SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
/** Monday first. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const dim = (text: string) => <span className="opacity-50">{text}</span>

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

/** "7 dias | 30 dias | 90 dias": drives every number and chart of the tab. */
export function PeriodSwitch({ value, onChange, className }: { value: Period; onChange: (period: Period) => void; className?: string }) {
  return <SegmentedPills items={PERIODS.map((p) => ({ id: String(p), label: `${p} dias` }))} value={String(value)} onChange={(id) => onChange(Number(id) as Period)} ariaLabel="Período" className={className} />
}

// ------------------------------------------------------------------ the four top cards

function TopCards({ habits, logs, today, period, isMobile }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; period: Period; isMobile: boolean }) {
  const consistency = overallConsistency(habits, logs, today, period)
  const streak = bestStreakOf(habits, logs, today, period)
  const weekdays = bestAndWorstWeekday(weekdayStats(habits, logs, today, period))
  const month = format(parseISO(today), "MMM", { locale: ptBR }).replace(".", "")

  const hero = <HeroCard key="hero" className="h-44" density="dense" label={`Constância · ${period} dias`} value={<>{consistency}{dim("%")}</>} support="média de todos os hábitos" progress={{ value: consistency, label: `Constância dos últimos ${period} dias` }} />
  const best = (
    <BentoStat key="best" label="Melhor sequência" icon={FlameIcon} className="h-44" chip={streak ? streak.habit.name : "Sem sequência ainda"}>
      {streak?.days ?? 0}
      {dim(` ${(streak?.days ?? 0) === 1 ? "dia" : "dias"}`)}
    </BentoStat>
  )
  const checkins = (
    <BentoStat key="checkins" label="Check-ins no mês" icon={CheckCheckIcon} className="h-44" chip={`registros em ${month}`}>
      {monthCheckins(logs, today)}
    </BentoStat>
  )
  const bestDay = (
    <BentoStat key="bestday" label="Melhor dia da semana" icon={CalendarDaysIcon} className="h-44" chip={weekdays ? `${SHORT[weekdays.worst.weekday]} é o mais difícil: ${weekdays.worst.rate}%` : "Sem dados no período"}>
      {weekdays ? (
        <>
          {SHORT[weekdays.best.weekday]} {weekdays.best.rate}
          {dim("%")}
        </>
      ) : (
        "—"
      )}
    </BentoStat>
  )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo das estatísticas"
        noun="resumo"
        initialHeight={176}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "best", node: best },
          { id: "checkins", node: checkins },
          { id: "bestday", node: bestDay },
        ]}
      />
    )
  }
  return (
    <div data-testid="stats-top" className="grid grid-cols-2 gap-4 @min-[1000px]:grid-cols-4">
      {[hero, best, checkins, bestDay].map((card, i) => (
        <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
          {card}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ weekly chart

const AXIS = 36

function WeeklyChart({ weeks, average, isMobile }: { weeks: WeekRate[]; average: number; isMobile: boolean }) {
  const summary = `Constância por semana: ${weeks.map((w) => `${format(parseISO(w.start), "d/M")} ${w.rate ?? 0}%`).join(", ")}.`
  return (
    <BentoCard title="Constância por semana" data-testid="stats-weekly" className="h-full" actions={<span data-chip className={chip}>média {average}%</span>}>
      {weeks.length === 0 ? (
        <p className="text-[13px] leading-5 text-muted-foreground">Sem dados suficientes no período.</p>
      ) : (
        <div role="img" aria-label={summary} className="relative h-[190px]">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 bottom-6">
            {[0, 50, 100].map((t) => (
              <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${t}%`, transform: "translateY(50%)" }}>
                <span className="tabular w-7 shrink-0 text-right text-[11px] leading-4 text-muted-foreground">{t}%</span>
                <span className={cn("flex-1 border-t", t === 0 ? "border-foreground/35" : "border-dashed border-foreground/20")} />
              </div>
            ))}
            <div data-testid="stats-average-line" className="absolute right-0 border-t-2 border-dashed border-primary" style={{ left: AXIS, bottom: `${average}%` }} />
          </div>
          <div className="absolute inset-y-0 right-0 flex" style={{ left: AXIS }}>
            {weeks.map((w, i) => {
              const current = i === weeks.length - 1
              const rate = w.rate ?? 0
              return (
                <div key={w.start} data-week={w.start} className="relative h-full min-w-0 flex-1">
                  <div className="absolute inset-x-0 top-6 bottom-6 flex justify-center">
                    <div className="relative w-[46%] max-w-8">
                      {rate > 0 ? <span data-bar={current ? "current" : "past"} className={cn("absolute inset-x-0 bottom-0 rounded-full", current ? "bg-primary" : "border border-foreground/20")} style={{ height: `${rate}%`, ...(current ? {} : HATCH_STYLE) }} /> : null}
                      <span className="tabular absolute left-1/2 z-10 -translate-x-1/2 rounded bg-card px-0.5 text-center text-[11px] leading-4 font-semibold" style={{ bottom: `calc(${rate}% + 4px)` }}>
                        {rate}%
                      </span>
                    </div>
                  </div>
                  <span aria-hidden className={cn("tabular absolute inset-x-0 bottom-0 h-6 pt-1 text-center whitespace-nowrap", isMobile ? "text-[10px] leading-5" : "text-[12px] leading-5", current ? "font-bold" : "text-muted-foreground")}>
                    {format(parseISO(w.start), isMobile ? "d/M" : "dd/MM")}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </BentoCard>
  )
}

// ------------------------------------------------------------------ per weekday

function WeekdayCard({ habits, logs, today, period }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; period: Period }) {
  const stats = weekdayStats(habits, logs, today, period)
  const extremes = bestAndWorstWeekday(stats)
  return (
    <BentoCard title="Por dia da semana" data-testid="stats-weekday" className="h-full" actions={<span data-chip className={chip}>{period} dias</span>}>
      <ul className="flex flex-col gap-3">
        {ORDER.map((d) => {
          const s = stats[d]
          const strong = extremes && extremes.best.weekday !== extremes.worst.weekday && (d === extremes.best.weekday || d === extremes.worst.weekday)
          return (
            <li key={d} data-weekday={d} className="flex items-center gap-3">
              <span className={cn("w-9 shrink-0 text-[13px] leading-5", strong ? "font-bold" : "text-muted-foreground")}>{SHORT[d]}</span>
              <HatchedProgress value={s.rate ?? 0} label={`${SHORT[d]}: ${s.rate === null ? "sem hábitos" : `${s.rate}%`}`} />
              <span className={cn("tabular w-10 shrink-0 text-right text-[13px] leading-5", strong ? "font-bold" : "text-muted-foreground")}>{s.rate === null ? "—" : `${s.rate}%`}</span>
            </li>
          )
        })}
      </ul>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ per habit

function DeltaChip({ stat }: { stat: HabitStat }) {
  if (stat.habit.paused) return <StatusChip icon={PauseIcon}>pausado</StatusChip>
  if (stat.delta > 0) return <StatusChip icon={ArrowUpIcon}>+{stat.delta} pts</StatusChip>
  if (stat.delta < 0) return <StatusChip icon={ArrowDownIcon}>−{Math.abs(stat.delta)} pts</StatusChip>
  return <StatusChip icon={MinusIcon}>estável</StatusChip>
}

function HabitsCard({ habits, logs, today, period }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; period: Period }) {
  const stats = habitStats(habits, logs, today, period)
  return (
    <BentoCard title="Por hábito" data-testid="stats-habits" className="h-full" actions={<span data-chip className={chip}>{period} dias</span>}>
      {stats.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum hábito ainda.</p> : null}
      <ul className="flex flex-col gap-4">
        {stats.map((stat) => (
          <li key={stat.habit.id} data-habit={stat.habit.id} data-paused={stat.habit.paused} className={cn("grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-2", stat.habit.paused && "opacity-60")}>
            <span aria-hidden className="row-span-2 flex size-8 items-center justify-center self-start rounded-full border border-border">
              <HabitGlyph name={stat.habit.name} className="size-4" />
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-semibold">{stat.habit.name}</span>
              <DeltaChip stat={stat} />
              <span className="tabular w-10 shrink-0 text-right text-[14px] leading-5 font-semibold">{stat.rate}%</span>
            </div>
            <HatchedProgress value={stat.rate} label={`${stat.habit.name}: ${stat.rate}% nos últimos ${period} dias`} />
          </li>
        ))}
      </ul>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ insights

const INSIGHT_ICON: Record<Insight["kind"], LucideIcon> = { weekday: CalendarDaysIcon, improved: TrendingUpIcon, below: TargetIcon }

function InsightsCard({ insights, habits, onEdit }: { insights: Insight[]; habits: HabitRow[]; onEdit: (habit: HabitRow) => void }) {
  return (
    <BentoCard title="Para você" data-testid="stats-insights" className="h-full">
      {insights.length === 0 ? (
        <div data-empty className="flex flex-col items-center gap-2 py-6 text-center">
          <SparklesIcon aria-hidden strokeWidth={1.75} className="size-7 text-muted-foreground" />
          <p className="text-[15px] leading-6 font-medium">Tudo em ordem por aqui</p>
          <p className="max-w-64 text-[13px] leading-5 text-muted-foreground">Nenhum ponto de atenção neste período. Continue assim e novas dicas aparecem quando houver algo a ajustar.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {insights.map((insight) => {
            const Icon = INSIGHT_ICON[insight.kind]
            const habit = habits.find((h) => h.id === insight.habitId)
            return (
              <li key={insight.kind} data-insight={insight.kind} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
                  <Icon strokeWidth={1.75} className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <p className="text-[14px] leading-5 font-bold">{insight.title}</p>
                    <p className="text-[13px] leading-5 text-muted-foreground">{insight.text}</p>
                  </div>
                  {insight.action && habit ? (
                    <Button variant="outline" className="h-9 w-fit rounded-full px-4" onClick={() => onEdit(habit)}>
                      {insight.action}
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </BentoCard>
  )
}

// ------------------------------------------------------------------ the tab

export function EstatisticasTab({ habits, logs, today, period, isMobile, onEdit }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; period: Period; isMobile: boolean; onEdit: (habit: HabitRow) => void }) {
  const active = habits.filter((h) => !h.paused)
  const weeks = weeklyRates(active, logs, today, weeksFor(period))
  const rated = weeks.filter((w) => w.rate !== null)
  const average = rated.length === 0 ? 0 : Math.round(rated.reduce((sum, w) => sum + (w.rate ?? 0), 0) / rated.length)
  const insights = insightsFor(habits, logs, today, period)
  return (
    <div data-testid="rotina-estatisticas" className="@container flex min-w-0 flex-col gap-4">
      <TopCards habits={active} logs={logs} today={today} period={period} isMobile={isMobile} />
      <div className="grid min-w-0 grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <div className="min-w-0 @min-[880px]:col-span-8">
          <WeeklyChart weeks={weeks} average={average} isMobile={isMobile} />
        </div>
        <div className="min-w-0 @min-[880px]:col-span-4">
          <WeekdayCard habits={active} logs={logs} today={today} period={period} />
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <div className="min-w-0 @min-[880px]:col-span-7">
          <HabitsCard habits={habits} logs={logs} today={today} period={period} />
        </div>
        <div className="min-w-0 @min-[880px]:col-span-5">
          <InsightsCard insights={insights} habits={habits} onEdit={onEdit} />
        </div>
      </div>
    </div>
  )
}
