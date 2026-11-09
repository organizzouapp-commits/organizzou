"use client"

import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DropletsIcon, FlameIcon, TargetIcon } from "lucide-react"

import { BentoCard, BentoStat, donutArcs, SegmentedPills } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { DayBadge, HeroCard } from "@/components/finance/parts"
import { HATCH_STYLE } from "@/components/habits/hoje-tab"
import { Button } from "@/components/ui/button"
import {
  HISTORY_PERIODS,
  averageKcal,
  averageWaterMl,
  dailyEntries,
  dayStatus,
  daysOnGoal,
  goalPercent,
  labelStep,
  mealInsight,
  mealShares,
  niceAxis,
  type DayEntry,
  type DayStatus,
  type HistoryPeriod,
  type MealShare,
} from "@/features/diet/history"
import { kcalText, litersText } from "@/features/diet/summary"
import { MEAL_LABELS, type DietGoalRow, type FoodRow, type MealItemRow } from "@/features/diet/types"
import { cn } from "@/lib/utils"

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const dim = (text: string) => <span className="text-[16px] leading-6 opacity-60">{text}</span>
const shortDate = (day: string) => format(parseISO(day), "d MMM", { locale: ptBR }).replace(".", "")
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "15 dias | 30 dias | 90 dias": drives every number and chart of the tab. */
export function HistoryPeriodSwitch({ value, onChange, className }: { value: HistoryPeriod; onChange: (period: HistoryPeriod) => void; className?: string }) {
  return <SegmentedPills items={HISTORY_PERIODS.map((p) => ({ id: String(p), label: `${p} dias` }))} value={String(value)} onChange={(id) => onChange(Number(id) as HistoryPeriod)} ariaLabel="Período" className={className} />
}

// ------------------------------------------------------------------ the four top cards

function TopCards({ entries, goal, waterAvg, isMobile, onEditGoal }: { entries: DayEntry[]; goal: DietGoalRow; waterAvg: number; isMobile: boolean; onEditGoal: () => void }) {
  const average = averageKcal(entries)
  const { hit, logged } = daysOnGoal(entries, goal.kcal)
  const percent = goalPercent(average, goal.kcal)

  const hero = (
    <HeroCard
      key="hero"
      className="h-48"
      density="dense"
      label="Média diária"
      value={
        <>
          {kcalText(average)} {dim("kcal")}
        </>
      }
      support={logged === 0 ? "Sem registros no período" : `${percent}% da meta de ${kcalText(goal.kcal)} kcal`}
      progress={{ value: percent, label: `Média diária: ${percent}% da meta` }}
    />
  )
  const onGoal = (
    <BentoStat key="goal-days" label="Dias na meta" icon={TargetIcon} className="h-48" chip="±10% da meta">
      {hit} {dim(`de ${logged}`)}
    </BentoStat>
  )
  const daily = (
    <BentoStat
      key="goal"
      label="Meta diária"
      icon={FlameIcon}
      className="h-48"
      footer={
        <div className="mt-auto">
          <Button variant="outline" className="h-9 w-fit rounded-full px-4" onClick={onEditGoal}>
            Editar meta
          </Button>
        </div>
      }
    >
      {kcalText(goal.kcal)} {dim("kcal")}
    </BentoStat>
  )
  const water = (
    <BentoStat key="water" label="Água média" icon={DropletsIcon} className="h-48" chip={`meta: ${litersText(goal.water_ml)} L`}>
      {waterAvg > 0 ? litersText(waterAvg) : "—"} {dim("L")}
    </BentoStat>
  )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo do histórico"
        noun="resumo"
        initialHeight={192}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "goal-days", node: onGoal },
          { id: "goal", node: daily },
          { id: "water", node: water },
        ]}
      />
    )
  }
  return (
    <div data-testid="history-top" className="grid grid-cols-2 gap-4 @min-[880px]:grid-cols-4">
      {[hero, onGoal, daily, water].map((card, i) => (
        <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
          {card}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ calories chart

const AXIS = 48
/** A bar is never shorter than this, so a small value still reads as a pill. */
const MIN_BAR = "8px"

function CaloriesChart({ entries, goal, average, period, isMobile, className }: { entries: DayEntry[]; goal: number; average: number; period: HistoryPeriod; isMobile: boolean; className?: string }) {
  const n = entries.length
  const { max, ticks } = niceAxis(Math.max(goal, ...entries.map((e) => e.kcal)))
  const step = labelStep(n, isMobile)
  const pct = (kcal: number) => (kcal / max) * 100
  const goalPct = pct(goal)

  return (
    <BentoCard title={`Calorias nos últimos ${period} dias`} data-testid="history-chart" className={className} actions={<span data-chip className={chip}>média {kcalText(average)} kcal</span>}>
      <div role="group" aria-label={`Calorias por dia nos últimos ${period} dias; meta de ${kcalText(goal)} kcal`} className="relative min-h-[240px] flex-1">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 bottom-6">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${pct(t)}%`, transform: "translateY(50%)" }}>
              <span className="tabular w-10 shrink-0 text-right text-[11px] leading-4 text-muted-foreground">{kcalText(t)}</span>
              <span className={cn("flex-1 border-t", t === 0 ? "border-foreground/35" : "border-dashed border-foreground/20")} />
            </div>
          ))}
          <div data-testid="history-goal-line" className="absolute right-0 border-t-2 border-dashed border-primary" style={{ left: AXIS, bottom: `${goalPct}%` }}>
            <span className="tabular absolute -top-[22px] left-1 rounded bg-card px-1 text-[11px] leading-4 font-semibold">meta {kcalText(goal)}</span>
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 flex" style={{ left: AXIS }}>
          {entries.map((e, i) => {
            const today = i === n - 1
            const height = `max(${pct(e.kcal)}%, ${MIN_BAR})`
            const labelled = (n - 1 - i) % step === 0
            const align = i < 2 ? "left-0" : i > n - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
            return (
              <button key={e.day} type="button" data-day={e.day} aria-label={`${shortDate(e.day)}: ${e.logged ? `${kcalText(e.kcal)} kcal` : "sem registros"}`} className="group relative h-full min-w-0 flex-1 outline-none">
                <span className="absolute inset-x-0 top-6 bottom-6 flex justify-center">
                  <span className="relative h-full w-[56%] max-w-6">
                    {e.logged ? <span data-bar={today ? "today" : "past"} className={cn("absolute inset-x-0 bottom-0 rounded-full group-focus-visible:ring-2 group-focus-visible:ring-ring", today ? "bg-primary" : "border border-foreground/20")} style={{ height, ...(today ? {} : HATCH_STYLE) }} /> : null}
                    {today && e.logged ? (
                      <span data-today-value className="tabular absolute left-1/2 z-10 -translate-x-1/2 rounded bg-card px-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap" style={{ bottom: `calc(${height} + 4px)` }}>
                        {kcalText(e.kcal)}
                      </span>
                    ) : null}
                    {!today ? (
                      <span role="tooltip" data-tooltip className={cn("tabular pointer-events-none absolute z-20 hidden rounded-[10px] border border-border bg-popover px-2 py-1 text-[12px] leading-4 whitespace-nowrap text-popover-foreground group-hover:block group-focus-visible:block", align)} style={{ bottom: `calc(${e.logged ? height : MIN_BAR} + 8px)` }}>
                        {shortDate(e.day)} · {e.logged ? `${kcalText(e.kcal)} kcal` : "sem registros"}
                      </span>
                    ) : null}
                  </span>
                </span>
                {labelled ? (
                  <span aria-hidden className={cn("tabular absolute bottom-0 h-6 pt-1 whitespace-nowrap", isMobile ? "text-[10px] leading-5" : "text-[12px] leading-5", today ? "right-0 font-bold" : "left-1/2 -translate-x-1/2 text-muted-foreground")}>
                    {format(parseISO(e.day), isMobile ? "d/M" : "dd/MM")}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ per meal

/** Lima, Lima 55%, Papel (white) and Papel 45%; in the light theme the tokens swap to Tinta, Tinta 55%, Lima verso and Tinta 35%. */
const MEAL_COLORS = ["var(--primary)", "color-mix(in oklab, var(--primary) 55%, transparent)", "var(--chart-3)", "var(--chart-4)"]

function MealCard({ shares, sentence, className }: { shares: MealShare[]; sentence: string | null; className?: string }) {
  const r = 44
  const c = 2 * Math.PI * r
  const arcs = donutArcs(shares.map((s) => s.share), c)
  const daily = shares.reduce((sum, s) => sum + s.kcal, 0)
  const summary = `Por refeição: ${shares.map((s) => `${MEAL_LABELS[s.meal]} ${Math.round(s.share)}%`).join(", ")}.`
  return (
    <BentoCard title="Por refeição" data-testid="history-meals" className={className}>
      <div className="flex flex-col items-center gap-4">
        <div role="img" aria-label={summary} className="relative size-[136px] shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" strokeWidth="16" className="stroke-muted" />
            {arcs.map((a) => (
              <circle key={shares[a.index].meal} data-segment={shares[a.index].meal} data-share={a.share.toFixed(4)} cx="60" cy="60" r={r} fill="none" strokeWidth="16" strokeLinecap="butt" style={{ stroke: MEAL_COLORS[a.index] }} strokeDasharray={`${a.dash} ${c - a.dash}`} strokeDashoffset={-a.offset} />
            ))}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span data-donut-total className="tabular text-[20px] leading-6 font-semibold">{kcalText(daily)}</span>
            <span className="text-[11px] leading-4 text-muted-foreground">kcal/dia</span>
          </span>
        </div>
        <ul className="flex w-full flex-col">
          {shares.map((s, i) => (
            <li key={s.meal} data-legend={s.meal} className="grid h-8 min-w-0 grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-[13px] leading-5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: MEAL_COLORS[i] }} />
              <span className="truncate">{MEAL_LABELS[s.meal]}</span>
              <span className="tabular text-right font-semibold">{Math.round(s.share)}%</span>
            </li>
          ))}
        </ul>
        {sentence ? (
          <p data-testid="history-insight" className="w-full border-t border-border pt-3 text-[13px] leading-5 text-muted-foreground">
            {sentence}
          </p>
        ) : daily === 0 ? (
          <p className="w-full border-t border-border pt-3 text-[13px] leading-5 text-muted-foreground">Sem registros neste período.</p>
        ) : null}
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ day by day

const STATUS_TEXT: Record<DayStatus, string> = { on: "na meta", under: "abaixo da meta", over: "acima da meta" }

function StatusChip({ status }: { status: DayStatus }) {
  return (
    <span data-status={status} className={cn("tabular inline-flex h-6 items-center rounded-full px-2 text-[12px] leading-4 whitespace-nowrap", status === "on" ? "bg-highlight font-semibold text-highlight-foreground" : "border border-foreground/25 text-muted-foreground")}>
      {STATUS_TEXT[status]}
    </span>
  )
}

function DayRow({ entry, goal, today, isMobile, onOpen }: { entry: DayEntry; goal: number; today: string; isMobile: boolean; onOpen: (day: string) => void }) {
  const date = parseISO(entry.day)
  const weekday = entry.day === today ? "Hoje" : capitalize(isMobile ? format(date, "EEEEEE", { locale: ptBR }).replace(".", "") : format(date, "EEEE", { locale: ptBR }).split("-")[0])
  const status = dayStatus(entry.kcal, goal)
  return (
    <li>
      <button type="button" data-day-row={entry.day} onClick={() => onOpen(entry.day)} className="flex min-h-[68px] w-full items-center gap-3 rounded-[14px] px-1 py-2 text-left outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
        <DayBadge day={date.getDate()} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] leading-6 font-semibold">
            {weekday}, {shortDate(entry.day)}
          </span>
          <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
            P {Math.round(entry.protein)} g · C {Math.round(entry.carbs)} g · G {Math.round(entry.fat)} g
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 md:flex-row md:items-center md:gap-3">
          <span className="tabular text-[15px] leading-6 font-semibold whitespace-nowrap">{kcalText(entry.kcal)} kcal</span>
          <StatusChip status={status} />
        </span>
      </button>
    </li>
  )
}

function DayByDay({ entries, goal, today, isMobile, onOpen }: { entries: DayEntry[]; goal: number; today: string; isMobile: boolean; onOpen: (day: string) => void }) {
  const rows = entries.filter((e) => e.logged).reverse()
  const half = Math.ceil(rows.length / 2)
  const columns = isMobile ? [rows] : [rows.slice(0, half), rows.slice(half)]
  return (
    <BentoCard title="Dia a dia" data-testid="history-days" actions={isMobile ? undefined : <span data-chip className={chip}>toque num dia para abrir</span>}>
      {rows.length === 0 ? (
        <p className="text-[13px] leading-5 text-muted-foreground">Nenhum alimento registrado neste período.</p>
      ) : (
        <div className={cn("grid gap-x-8", !isMobile && "grid-cols-2")}>
          {columns.map((list, i) => (
            <ul key={i} className="flex min-w-0 flex-col divide-y divide-border">
              {list.map((entry) => (
                <DayRow key={entry.day} entry={entry} goal={goal} today={today} isMobile={isMobile} onOpen={onOpen} />
              ))}
            </ul>
          ))}
        </div>
      )}
    </BentoCard>
  )
}

// ------------------------------------------------------------------ the tab

export function HistoricoTab({ items, foods, water, goal, today, period, isMobile, onEditGoal, onOpenDay }: { items: MealItemRow[]; foods: FoodRow[]; water: { log_date?: string; ml: number }[]; goal: DietGoalRow; today: string; period: HistoryPeriod; isMobile: boolean; onEditGoal: () => void; onOpenDay: (day: string) => void }) {
  const entries = dailyEntries(items, foods, today, period)
  const shares = mealShares(items, foods, today, period)
  return (
    <div data-testid="dieta-historico" data-period={period} className="@container flex min-w-0 flex-col gap-4">
      <TopCards entries={entries} goal={goal} waterAvg={averageWaterMl(water, today, period)} isMobile={isMobile} onEditGoal={onEditGoal} />
      <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <CaloriesChart entries={entries} goal={goal.kcal} average={averageKcal(entries)} period={period} isMobile={isMobile} className="@min-[880px]:col-span-8" />
        <MealCard shares={shares} sentence={mealInsight(shares)} className="@min-[880px]:col-span-4" />
      </div>
      <DayByDay entries={entries} goal={goal.kcal} today={today} isMobile={isMobile} onOpen={onOpenDay} />
    </div>
  )
}

