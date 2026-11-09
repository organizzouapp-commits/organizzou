"use client"

import { useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ActivityIcon,
  BookOpenIcon,
  BrainIcon,
  CheckIcon,
  DropletsIcon,
  DumbbellIcon,
  EllipsisIcon,
  FlameIcon,
  FootprintsIcon,
  GraduationCapIcon,
  MinusIcon,
  MoonIcon,
  PauseIcon,
  PencilIcon,
  PenLineIcon,
  PersonStandingIcon,
  PillIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  SaladIcon,
  TargetIcon,
  Trash2Icon,
  TrendingDownIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"

import { BentoCard, BentoStat, Sparkline } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { AddPill, EmptyBlock, HatchedProgress, HeroCard, LIST_CARD } from "@/components/finance/parts"
import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DEFAULT_OPEN, localHabitGroupRepo, type HabitGroupId } from "@/features/habits/group-state"
import { habitIconKey, type HabitIconKey } from "@/features/habits/icon"
import {
  consistencyDelta,
  currentStreak,
  dailyRates,
  dueOn,
  isDone,
  isScheduled,
  overallConsistency,
  recordStreak,
  shiftDay,
  topStreaks,
  weekStrip,
  type DayState,
} from "@/features/habits/stats"
import type { HabitLogRow, HabitRow } from "@/features/habits/types"
import { clockOf } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

const ICONS: Record<HabitIconKey, LucideIcon> = {
  water: DropletsIcon,
  book: BookOpenIcon,
  workout: DumbbellIcon,
  walk: FootprintsIcon,
  meditate: BrainIcon,
  sleep: MoonIcon,
  pill: PillIcon,
  study: GraduationCapIcon,
  stretch: PersonStandingIcon,
  food: SaladIcon,
  write: PenLineIcon,
  default: TargetIcon,
}
/** The icon of a habit, derived from its name. */
export function HabitGlyph({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[habitIconKey(name)]
  return <Icon aria-hidden strokeWidth={1.75} className={className} />
}

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
export const dayName = (day: string) => WEEKDAY_NAMES[parseISO(day).getDay()]
const letterOf = (day: string) => format(parseISO(day), "EEEEE", { locale: ptBR }).toUpperCase()
export const formatQty = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const HATCH = "repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 30%, transparent) 0 1.5px, transparent 1.5px 5px)"
export const HATCH_STYLE = { backgroundImage: HATCH } as const

/** The 7 circles of the strip: 20 px on phones, 22 px from a 560 px list on. The weekday letters above the first card use the very same grid. */
const STRIP = "grid grid-cols-[repeat(7,20px)] gap-1 @min-[560px]:grid-cols-[repeat(7,22px)] @min-[560px]:gap-1.5"

// ------------------------------------------------------------------ the pieces of a habit row

/**
 * The 36 px leading control of every habit: the habit icon in a circle. A fixed habit is a ring you tap (it turns Lima with a check);
 * a quantity habit shows its progress as an arc around the icon and is changed with − / +.
 */
export function Lead({ habit, done, qty, disabled, onToggle }: { habit: HabitRow; done: boolean; qty: number; disabled: boolean; onToggle: () => void }) {
  const goal = habit.type === "goal"
  const target = habit.target_qty ?? 1
  const progress = Math.max(0, Math.min(1, qty / target))
  const R = 16
  const C = 2 * Math.PI * R
  const face = done ? <CheckIcon aria-hidden strokeWidth={2.25} className="size-[18px]" /> : <HabitGlyph name={habit.name} className="size-[18px]" />
  const base = "relative flex size-9 shrink-0 items-center justify-center rounded-full"
  if (goal) {
    return (
      <span role="progressbar" aria-label={`Progresso de ${habit.name}`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(qty, target)} data-lead className={cn(base, done ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
        {!done ? (
          <svg aria-hidden viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
            <circle cx="18" cy="18" r={R} fill="none" strokeWidth="2.5" className="stroke-foreground/20" />
            <circle cx="18" cy="18" r={R} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} className="stroke-primary transition-[stroke-dashoffset] duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" />
          </svg>
        ) : null}
        {face}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-lead
      aria-pressed={done}
      aria-label={`${done ? "Desmarcar" : "Marcar"} ${habit.name}`}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        base,
        "outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] after:absolute after:-inset-1 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none motion-reduce:transition-none",
        done ? "bg-primary text-primary-foreground" : "border-2 border-foreground/30 text-muted-foreground hover:border-foreground/60 hover:text-foreground"
      )}
    >
      {face}
    </button>
  )
}

export const STATE_TEXT: Record<DayState, string> = { done: "feito", missed: "não feito", off: "sem agenda", pending: "pendente" }

/** One circle of a strip: done = Lima with a check, pending = Lima ring, missed = hatched, off = a tiny dim dot. */
export function DayDot({ state, size = "size-5 @min-[560px]:size-[22px]" }: { state: DayState; size?: string }) {
  if (state === "off") return <span aria-hidden className={cn(size, "flex items-center justify-center")}><span className="size-1 rounded-full bg-muted-foreground/40" /></span>
  if (state === "done") return <span aria-hidden className={cn(size, "flex items-center justify-center rounded-full bg-primary text-primary-foreground")}><CheckIcon strokeWidth={2.5} className="size-3" /></span>
  if (state === "pending") return <span aria-hidden className={cn(size, "rounded-full border-2 border-primary")} />
  return <span aria-hidden className={cn(size, "rounded-full border border-foreground/20")} style={HATCH_STYLE} />
}

/** The last 7 days of one habit. Per-day status is also text for screen readers. */
function WeekStrip({ habit, logs, selected, className }: { habit: HabitRow; logs: HabitLogRow[]; selected: string; className?: string }) {
  return (
    <ul aria-label="Últimos 7 dias" data-strip className={cn(STRIP, className)}>
      {weekStrip(habit, logs, selected).map(({ day, state }) => (
        <li key={day} data-day-state={state} className="flex items-center justify-center">
          <DayDot state={state} />
          <span className="sr-only">
            {dayName(day)}, {format(parseISO(day), "d")}: {STATE_TEXT[state]}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The weekday letters, once per group, above the first card: same grid as the strips, today's letter emphasised. */
function StripLetters({ selected }: { selected: string }) {
  return (
    <div aria-hidden data-strip-letters className={cn(STRIP, "text-[11px] leading-4 font-medium text-muted-foreground")}>
      {Array.from({ length: 7 }, (_, i) => {
        const day = shiftDay(selected, i - 6)
        return (
          <span key={day} className={cn("text-center", i === 6 && "font-bold text-primary")}>
            {letterOf(day)}
          </span>
        )
      })}
    </div>
  )
}

export function Stepper({ habit, qty, disabled, onStep }: { habit: HabitRow; qty: number; disabled: boolean; onStep: (direction: 1 | -1) => void }) {
  const button = "relative flex size-8 shrink-0 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] after:absolute after:-inset-1.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
  return (
    <div className="flex items-center justify-end gap-2" data-stepper>
      <button type="button" disabled={disabled || qty <= 0} aria-label={`Diminuir ${habit.name}`} onClick={() => onStep(-1)} className={button}>
        <MinusIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
      <button type="button" disabled={disabled} aria-label={`Aumentar ${habit.name}`} onClick={() => onStep(1)} className={button}>
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
    </div>
  )
}

export type HojeActions = {
  onToggle: (habit: HabitRow) => void
  onStep: (habit: HabitRow, direction: 1 | -1) => void
  onPause: (habit: HabitRow) => void
  onEdit: (habit: HabitRow) => void
  onDelete: (habit: HabitRow) => void
  onCreate: () => void
  onOpenStats: () => void
}

function HabitCard({ habit, logs, selected, actions }: { habit: HabitRow; logs: HabitLogRow[]; selected: string; actions: HojeActions }) {
  const scheduled = isScheduled(habit, selected)
  const log = logs.find((l) => l.habit_id === habit.id && l.log_date === selected)
  const qty = log?.qty ?? 0
  const done = isDone(habit, logs, selected)
  const streak = habit.paused ? 0 : currentStreak(habit, logs, selected)
  const goal = habit.type === "goal"
  const disabled = habit.paused || !scheduled
  const meta = habit.paused ? "Pausado" : !scheduled ? "Folga neste dia" : done ? `Feito às ${clockOf(log?.updated_at ?? new Date().toISOString())}` : goal ? `${formatQty(qty)} / ${formatQty(habit.target_qty ?? 0)} ${habit.unit ?? ""}`.trim() : "Pendente"
  return (
    <li
      data-habit={habit.id}
      data-done={done}
      data-paused={habit.paused}
      className={cn(LIST_CARD, "grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-x-3 gap-y-2 p-3 @min-[560px]:grid-cols-[36px_minmax(0,1fr)_72px_190px_36px]", habit.paused && "opacity-60")}
    >
      <Lead habit={habit} done={done} qty={qty} disabled={disabled} onToggle={() => actions.onToggle(habit)} />
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-5 font-semibold">{habit.name}</p>
        <p className="tabular flex items-center gap-x-2 text-[13px] leading-5 text-muted-foreground">
          <span className="truncate">{meta}</span>
          {streak > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <FlameIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
              {plural(streak, "dia", "dias")}
            </span>
          ) : null}
        </p>
      </div>
      <div className="col-start-2 col-end-4 row-start-2 flex items-center justify-between gap-2 @min-[560px]:contents">
        <WeekStrip habit={habit} logs={logs} selected={selected} className="col-start-2 @min-[560px]:col-start-4 @min-[560px]:row-start-1" />
        {goal ? (
          <div className="@min-[560px]:col-start-3 @min-[560px]:row-start-1 @min-[560px]:col-end-4">
            <Stepper habit={habit} qty={qty} disabled={disabled} onStep={(d) => actions.onStep(habit, d)} />
          </div>
        ) : null}
      </div>
      <div className="col-start-3 row-start-1 @min-[560px]:col-start-5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Opções de ${habit.name}`} className="relative size-9 rounded-full after:absolute after:-inset-1">
              <EllipsisIcon strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.onEdit(habit)}>
              <PencilIcon strokeWidth={1.75} /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onPause(habit)}>
              {habit.paused ? <PlayIcon strokeWidth={1.75} /> : <PauseIcon strokeWidth={1.75} />}
              {habit.paused ? "Retomar" : "Pausar"}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(habit)}>
              <Trash2Icon strokeWidth={1.75} /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

// ------------------------------------------------------------------ the grouped list

export function useGroups() {
  const [state, setState] = useState<Partial<Record<HabitGroupId, boolean>>>({})
  useEffect(() => {
    // localStorage only exists in the browser; read after mount so the server and the first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(localHabitGroupRepo.load())
  }, [])
  const isOpen = (id: HabitGroupId) => state[id] ?? DEFAULT_OPEN[id]
  const toggle = (id: HabitGroupId) =>
    setState((current) => {
      const next = { ...current, [id]: !(current[id] ?? DEFAULT_OPEN[id]) }
      localHabitGroupRepo.save(next)
      return next
    })
  const open = (id: HabitGroupId) =>
    setState((current) => {
      const next = { ...current, [id]: true }
      localHabitGroupRepo.save(next)
      return next
    })
  return { isOpen, toggle, open }
}
export type HabitGroups = ReturnType<typeof useGroups>

function HabitGroup({ id, label, habits, open, onToggle, letters, footer, children }: { id: HabitGroupId; label: string; habits: HabitRow[]; open: boolean; onToggle: () => void; letters?: React.ReactNode; children: (habit: HabitRow) => React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section data-group={id} aria-label={label} className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between">
        <GroupHeader label={label} count={habits.length} open={open} onToggle={onToggle} />
        {open && letters && habits.length > 0 ? (
          <div className="basis-full pb-1 @min-[560px]:basis-auto @min-[560px]:pb-0">
            <div className="ml-[61px] w-fit @min-[560px]:mr-[61px] @min-[560px]:ml-0" data-letters-slot>
              {letters}
            </div>
          </div>
        ) : null}
      </div>
      <Collapse open={open}>
        <ul className="flex flex-col gap-2 pb-2">{habits.map((habit) => children(habit))}</ul>
        {footer}
      </Collapse>
    </section>
  )
}

// ------------------------------------------------------------------ the 7-day chart and the streaks

const AXIS = 36

function WeekChart({ habits, logs, selected }: { habits: HabitRow[]; logs: HabitLogRow[]; selected: string }) {
  const [tip, setTip] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(selected, i - 6)
    const due = dueOn(habits, day)
    const done = due.filter((h) => isDone(h, logs, day)).length
    return { day, total: due.length, done, rate: due.length === 0 ? null : done / due.length }
  })
  const withRate = days.filter((d) => d.rate !== null)
  const average = withRate.length === 0 ? 0 : Math.round((withRate.reduce((s, d) => s + (d.rate ?? 0), 0) / withRate.length) * 100)
  const show = (day: string) => {
    setTip(day)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setTip((c) => (c === day ? null : c)), 3500)
  }
  const tipDay = days.find((d) => d.day === tip)
  const summary = `Últimos 7 dias: ${days.map((d) => `${dayName(d.day)} ${d.total === 0 ? "sem hábitos" : `${d.done} de ${d.total}`}`).join(", ")}.`

  return (
    <BentoCard title="Últimos 7 dias" data-testid="rotina-week" actions={<span data-chip className="tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 text-muted-foreground">média {average}%</span>}>
      <div role="group" aria-label={summary} className="relative h-[150px]" onPointerLeave={(e) => e.pointerType === "mouse" && setTip(null)}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-2 bottom-6">
          {[0, 50, 100].map((t) => (
            <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${t}%`, transform: "translateY(50%)" }}>
              <span className="tabular w-7 shrink-0 text-right text-[11px] leading-4 text-muted-foreground">{t}%</span>
              <span className={cn("flex-1 border-t", t === 0 ? "border-foreground/35" : "border-dashed border-foreground/20")} />
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 right-0 flex" style={{ left: AXIS }}>
          {days.map((d, i) => {
            const today = i === 6
            return (
              <button
                key={d.day}
                type="button"
                data-week-day={d.day}
                aria-label={`${dayName(d.day)}: ${d.total === 0 ? "sem hábitos" : `${d.done} de ${d.total} hábitos`}`}
                onClick={() => show(d.day)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setTip(d.day)}
                onFocus={() => setTip(d.day)}
                onBlur={() => setTip(null)}
                className="relative h-full min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="absolute inset-x-0 top-2 bottom-6 flex justify-center">
                  <span className="relative w-[46%] max-w-7">
                    {d.rate !== null && d.rate > 0 ? (
                      <span
                        data-bar={today ? "today" : "past"}
                        className={cn("absolute inset-x-0 bottom-0 rounded-full", today ? "bg-primary" : "border border-foreground/20")}
                        style={{ height: `${d.rate * 100}%`, ...(today ? {} : HATCH_STYLE) }}
                      />
                    ) : null}
                  </span>
                </span>
                <span className={cn("absolute inset-x-0 bottom-0 h-6 pt-1 text-center text-[12px] leading-5", today ? "font-bold" : "text-muted-foreground")}>{letterOf(d.day)}</span>
              </button>
            )
          })}
        </div>
        {tipDay ? (
          <div data-testid="rotina-week-tip" role="status" className="pointer-events-none absolute top-0 z-20 w-36 -translate-x-1/2 rounded-[12px] border border-border bg-popover px-3 py-2 text-popover-foreground" style={{ left: `clamp(72px, calc(${AXIS}px + (100% - ${AXIS}px) * ${(days.indexOf(tipDay) + 0.5) / 7}), calc(100% - 72px))` }}>
            <p className="text-[12px] leading-5 font-semibold capitalize">
              {dayName(tipDay.day)}, {format(parseISO(tipDay.day), "d")}
            </p>
            <p className="tabular text-[12px] leading-5 text-muted-foreground">{tipDay.total === 0 ? "Sem hábitos" : `${tipDay.done} de ${tipDay.total} hábitos`}</p>
          </div>
        ) : null}
      </div>
    </BentoCard>
  )
}

function StreaksCard({ habits, logs, selected }: { habits: HabitRow[]; logs: HabitLogRow[]; selected: string }) {
  const top = topStreaks(habits, logs, selected)
  const record = Math.max(0, ...habits.map((h) => recordStreak(h, logs, selected)))
  return (
    <BentoCard title="Sequências" data-testid="rotina-streaks" actions={record > 0 ? <span data-chip className="tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground">recorde {plural(record, "dia", "dias")}</span> : null}>
      {top.length === 0 ? (
        <p className="text-[13px] leading-5 text-muted-foreground">Nenhuma sequência ativa ainda. Conclua um hábito hoje para começar.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {top.map(({ habit, streak, record: own }) => {
            return (
              <li key={habit.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border">
                    <HabitGlyph name={habit.name} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium">{habit.name}</span>
                  <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">{plural(streak, "dia", "dias")}</span>
                </div>
                <HatchedProgress value={(streak / Math.max(own, streak, 1)) * 100} label={`Sequência de ${habit.name}: ${plural(streak, "dia", "dias")} de ${plural(Math.max(own, streak), "dia", "dias")} de recorde`} />
              </li>
            )
          })}
        </ul>
      )}
    </BentoCard>
  )
}

// ------------------------------------------------------------------ the top cards

function TopCards({ habits, logs, today, selected, isMobile, actions }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; selected: string; isMobile: boolean; actions: HojeActions }) {
  const due = dueOn(habits, selected)
  const done = due.filter((h) => isDone(h, logs, selected)).length
  const pct = due.length === 0 ? 0 : Math.round((done / due.length) * 100)
  const left = due.length - done
  const consistency = overallConsistency(habits, logs, selected)
  const delta = consistencyDelta(habits, logs, selected)
  const rates = dailyRates(habits, logs, selected)
  const streaks = habits.filter((h) => !h.paused).map((habit) => ({ habit, best: recordStreak(habit, logs, today), current: currentStreak(habit, logs, today) }))
  const best = streaks.reduce<(typeof streaks)[number] | null>((a, b) => (!a || b.best > a.best ? b : a), null)
  const dim = (text: string) => <span className="opacity-50">{text}</span>

  const hero = (
    <HeroCard
      key="hero"
      className="h-44"
      density="dense"
      label={selected === today ? "Hábitos hoje" : "Hábitos do dia"}
      value={
        <>
          {done}
          {dim(`/${due.length}`)}
        </>
      }
      support={due.length === 0 ? "Nenhum hábito neste dia" : `${pct}% do dia · ${left === 0 ? "tudo feito" : `falta${left === 1 ? "" : "m"} ${plural(left, "hábito", "hábitos")}`}`}
      progress={{ value: pct, label: "Progresso dos hábitos do dia" }}
      onArrow={actions.onOpenStats}
      arrowLabel="Ver estatísticas"
    />
  )
  const trend = delta >= 0 ? TrendingUpIcon : TrendingDownIcon
  const consistencyCard = (
    <BentoStat
      key="consistency"
      label="Constância · 30 dias"
      icon={ActivityIcon}
      className="h-44 gap-1.5"
      chip={`${delta > 0 ? "+" : ""}${delta} pts vs. 30 dias antes`}
      chipIcon={trend}
      footer={<Sparkline points={rates} label="Taxa diária de conclusão nos últimos 30 dias" tone="default" className="h-7" />}
    >
      {consistency}
      {dim("%")}
    </BentoStat>
  )
  const bestCard = (
    <BentoStat key="best" label="Melhor sequência" icon={FlameIcon} className="h-44" chip={best && best.best > 0 ? `${best.habit.name} · Atual: ${plural(best.current, "dia", "dias")}` : "Sem sequência ainda"} chipIcon={RepeatIcon}>
      {best?.best ?? 0}
      {dim(` ${(best?.best ?? 0) === 1 ? "dia" : "dias"}`)}
    </BentoStat>
  )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo dos hábitos"
        noun="resumo"
        initialHeight={176}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "consistency", node: consistencyCard },
          { id: "best", node: bestCard },
        ]}
      />
    )
  }
  return (
    <div data-testid="rotina-top" className="grid grid-cols-12 gap-4">
      <div className="col-span-5 flex min-w-0 flex-col [&>*]:flex-1">{hero}</div>
      <div className="col-span-4 flex min-w-0 flex-col [&>*]:flex-1">{consistencyCard}</div>
      <div className="col-span-3 flex min-w-0 flex-col [&>*]:flex-1">{bestCard}</div>
    </div>
  )
}

// ------------------------------------------------------------------ the tab

export function HojeTab({ groups, habits, logs, today, selected, isMobile, actions }: { groups: HabitGroups; habits: HabitRow[]; logs: HabitLogRow[]; today: string; selected: string; isMobile: boolean; actions: HojeActions }) {
  const forToday = habits.filter((h) => !h.paused && isScheduled(h, selected) && !isDone(h, logs, selected))
  const finished = habits.filter((h) => !h.paused && isScheduled(h, selected) && isDone(h, logs, selected))
  const off = habits.filter((h) => !h.paused && !isScheduled(h, selected))
  const paused = habits.filter((h) => h.paused)
  // The letters appear once, in the first group that shows cards.
  const lettersIn = ([["hoje", forToday], ["concluidos", finished], ["folga", off], ["pausados", paused]] as [HabitGroupId, HabitRow[]][]).find(([id, list]) => list.length > 0 && groups.isOpen(id))?.[0]
  const letters = <StripLetters selected={selected} />
  const card = (habit: HabitRow) => <HabitCard key={habit.id} habit={habit} logs={logs} selected={selected} actions={actions} />

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="rotina-hoje">
      <TopCards habits={habits} logs={logs} today={today} selected={selected} isMobile={isMobile} actions={actions} />
      <div className="@container min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-1 @min-[880px]:col-span-8">
          {habits.length === 0 ? (
            <EmptyBlock
              icon={RepeatIcon}
              title="Nenhum hábito ainda"
              description="Comece com um hábito pequeno, como beber água ou ler 10 páginas. Ele aparece aqui e em Hoje."
              action={
                <Button className="h-11 rounded-full px-5" onClick={actions.onCreate}>
                  <PlusIcon strokeWidth={1.75} /> Criar o primeiro hábito
                </Button>
              }
            />
          ) : (
            <div className="@container flex flex-col gap-1">
              <HabitGroup id="hoje" label="Para hoje" habits={forToday} open={groups.isOpen("hoje")} onToggle={() => groups.toggle("hoje")} letters={lettersIn === "hoje" ? letters : undefined} footer={<AddPill label="Adicionar hábito… ex.: caminhar 30 min" onClick={actions.onCreate} className="mb-2" />}>
                {card}
              </HabitGroup>
              {finished.length > 0 ? (
                <HabitGroup id="concluidos" label="Concluídos" habits={finished} open={groups.isOpen("concluidos")} onToggle={() => groups.toggle("concluidos")} letters={lettersIn === "concluidos" ? letters : undefined}>
                  {card}
                </HabitGroup>
              ) : null}
              {off.length > 0 ? (
                <HabitGroup id="folga" label="Folga neste dia" habits={off} open={groups.isOpen("folga")} onToggle={() => groups.toggle("folga")} letters={lettersIn === "folga" ? letters : undefined}>
                  {card}
                </HabitGroup>
              ) : null}
              {paused.length > 0 ? (
                <HabitGroup id="pausados" label="Pausados" habits={paused} open={groups.isOpen("pausados")} onToggle={() => groups.toggle("pausados")} letters={lettersIn === "pausados" ? letters : undefined}>
                  {card}
                </HabitGroup>
              ) : null}
            </div>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-4 @min-[880px]:col-span-4">
          <WeekChart habits={habits} logs={logs} selected={selected} />
          <StreaksCard habits={habits} logs={logs} selected={selected} />
        </aside>
      </div>
      </div>
    </div>
  )
}
