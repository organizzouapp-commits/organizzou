"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckIcon, ChevronDownIcon, FlameIcon, PencilIcon } from "lucide-react"

import { BentoCard, SegmentedPills } from "@/components/finance/bento"
import { LIST_CARD, StatusChip } from "@/components/finance/parts"
import { DayDot, HATCH_STYLE, HabitGlyph, Lead, Stepper, dayName, formatQty, plural } from "@/components/habits/hoje-tab"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  averageRate,
  blockStarts,
  completionLevel,
  currentStreak,
  dayRecord,
  dayStrip,
  dueOn,
  fourWeekCells,
  habitDayKind,
  isDone,
  isScheduled,
  monthCells,
  windowRate,
  type Level,
} from "@/features/habits/stats"
import type { HabitLogRow, HabitRow } from "@/features/habits/types"
import { clockOf } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

export type HistoryMode = "mes" | "semanas"
export const HISTORY_MODES = [
  { id: "mes" as const, label: "Mês" },
  { id: "semanas" as const, label: "4 semanas" },
]

const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"]
const longDate = (day: string) => `${dayName(day)}, ${format(parseISO(day), "d 'de' MMMM", { locale: ptBR })}`

// ------------------------------------------------------------------ the toolbar pieces (the screen places them)

/** "Todos os hábitos ⌄": one dropdown pill that replaces the row of habit chips. */
export function HistoryFilter({ habits, value, onChange }: { habits: HabitRow[]; value: string; onChange: (id: string) => void }) {
  const current = habits.find((h) => h.id === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-testid="history-filter" aria-label={`Filtrar por hábito: ${current?.name ?? "todos os hábitos"}`} className="relative inline-flex h-9 max-w-64 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] leading-5 whitespace-nowrap outline-none transition-colors duration-[400ms] after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
          <span className="truncate">{current?.name ?? "Todos os hábitos"}</span>
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {[{ id: "all", name: "Todos os hábitos" }, ...habits].map((h) => (
          <DropdownMenuItem key={h.id} onSelect={() => onChange(h.id)}>
            <span className="min-w-0 flex-1 truncate">{h.name}</span>
            {h.id === value ? <CheckIcon aria-hidden strokeWidth={1.75} /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function HistoryModeSwitch({ value, onChange, className }: { value: HistoryMode; onChange: (mode: HistoryMode) => void; className?: string }) {
  return <SegmentedPills items={HISTORY_MODES} value={value} onChange={onChange} ariaLabel="Período do calendário" className={className} />
}

// ------------------------------------------------------------------ calendar

const LEVEL_CLASS: Record<Level, string> = {
  4: "bg-palette-lima text-highlight-foreground",
  3: "bg-palette-lima/65 text-highlight-foreground",
  2: "bg-palette-lima/40 text-foreground",
  1: "bg-palette-lima/18 text-foreground",
  0: "border-foreground/20 text-foreground",
}
const LEVELS: Level[] = [1, 2, 3, 4]

function Legend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 @min-[560px]:items-end", className)}>
      <p aria-hidden className="flex items-center justify-center gap-1.5 text-[12px] leading-4 text-muted-foreground">
        Menos
        <span className="size-3.5 rounded-[4px] border border-foreground/20" style={HATCH_STYLE} />
        {LEVELS.map((level) => (
          <span key={level} className={cn("size-3.5 rounded-[4px]", LEVEL_CLASS[level])} />
        ))}
        Mais
      </p>
      <p className="text-center text-[11px] leading-4 text-muted-foreground @min-[560px]:text-right">Anel forte: dia selecionado</p>
    </div>
  )
}

function CalendarCard({ habits, logs, today, habitId, month, mode, selected, onSelect, onMode, isMobile }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; habitId: string; month: string; mode: HistoryMode; selected: string; onSelect: (day: string) => void; onMode: (mode: HistoryMode) => void; isMobile: boolean }) {
  const single = habits.find((h) => h.id === habitId) ?? null
  const cells = mode === "mes" ? monthCells(month) : fourWeekCells(today)
  const title = mode === "mes" ? format(parseISO(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()) : "Últimas 4 semanas"
  const scope = single ? [single] : habits

  return (
    <BentoCard title={title} data-testid="history-calendar" actions={isMobile ? null : <HistoryModeSwitch value={mode} onChange={onMode} />}>
      <div className="@container flex flex-col gap-3">
        <div className="grid grid-cols-7 gap-1.5 @min-[560px]:gap-2">
          {WEEKDAY_LETTERS.map((letter, i) => (
            <span key={i} aria-hidden className="pb-0.5 text-center text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {letter}
            </span>
          ))}
          {cells.map(({ day, inMonth }) => {
            const record = dayRecord(scope, logs, day)
            const future = day > today
            const isToday = day === today
            const kind = single ? habitDayKind(single, logs, day, today) : null
            const level: Level = single ? (kind === "done" ? 4 : 0) : completionLevel(record.rate)
            const hatched = inMonth && !future && !isToday && (single ? kind === "missed" : record.total > 0 && level === 0)
            const filled = inMonth && (single ? kind === "done" : level > 0 && record.total > 0)
            const dayNumber = format(parseISO(day), "d")
            const status = single ? (kind === "done" ? "feito" : kind === "missed" ? "não feito" : kind === "off" ? "sem agenda" : "pendente") : record.total === 0 ? "sem hábitos" : `${record.done} de ${record.total} hábitos`
            const fraction = !single && inMonth && !future && record.total > 0 ? `${record.done}/${record.total}` : null
            return (
              <button
                key={day}
                type="button"
                data-day={day}
                data-level={filled ? level : hatched ? 0 : undefined}
                aria-pressed={day === selected}
                aria-label={`${format(parseISO(day), "d 'de' MMMM", { locale: ptBR })}${isToday ? " (hoje)" : ""}, ${status}`}
                onClick={() => onSelect(day)}
                className={cn(
                  "relative flex h-11 min-w-0 flex-col items-center justify-center rounded-[14px] border-2 border-transparent p-0 text-[14px] leading-5 outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none @min-[560px]:h-[72px] @min-[560px]:items-start @min-[560px]:justify-between @min-[560px]:p-2.5 @min-[560px]:text-[15px]",
                  !inMonth ? "text-muted-foreground" : filled ? LEVEL_CLASS[level] : hatched ? "border-foreground/20 text-foreground" : future || isToday ? "bg-muted/50 text-muted-foreground" : "bg-muted/30 text-muted-foreground",
                  isToday && "border-primary",
                  day === selected && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                )}
                style={hatched ? HATCH_STYLE : undefined}
              >
                <span className="tabular font-semibold">
                  {dayNumber}
                  {isToday ? <span className="hidden text-[12px] font-medium @min-[560px]:inline"> · hoje</span> : null}
                </span>
                {fraction ? <span className="tabular hidden text-[12px] leading-4 @min-[560px]:block">{fraction}</span> : null}
              </button>
            )
          })}
        </div>
        <Legend />
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ day detail

function DetailCard({ habits, logs, today, habitId, day, onAdjust }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; habitId: string; day: string; onAdjust: () => void }) {
  const single = habits.find((h) => h.id === habitId) ?? null
  const scope = single ? [single] : habits
  const rows = dueOn(scope, day)
  const done = rows.filter((h) => isDone(h, logs, day)).length
  const paused = (single ? [single] : habits).filter((h) => h.paused).length
  const future = day > today
  return (
    <BentoCard title={longDate(day)} subtitle="Registro do dia selecionado" data-testid="history-day" actions={<span data-chip className="tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground">{done} de {rows.length}</span>}>
      {rows.length === 0 ? (
        <p className="text-[13px] leading-5 text-muted-foreground">Nenhum hábito previsto para este dia.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((habit) => {
            const log = logs.find((l) => l.habit_id === habit.id && l.log_date === day)
            const isOk = isDone(habit, logs, day)
            const qty = log?.qty ?? 0
            const secondary = isOk ? `Feito às ${clockOf(log?.updated_at ?? new Date().toISOString())}` : future ? "A fazer" : habit.type === "goal" ? `${formatQty(qty)} / ${formatQty(habit.target_qty ?? 0)} ${habit.unit ?? ""}`.trim() : "Não feito"
            return (
              <li key={habit.id} data-habit={habit.id} data-done={isOk} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", isOk ? "bg-primary text-primary-foreground" : "border border-foreground/20")} style={isOk ? undefined : HATCH_STYLE}>
                  {isOk ? <CheckIcon strokeWidth={2.25} className="size-4" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] leading-5 font-semibold">{habit.name}</p>
                  <p className="tabular truncate text-[13px] leading-5 text-muted-foreground">{secondary}</p>
                </div>
                <HabitGlyph name={habit.name} className="size-[18px] shrink-0 text-muted-foreground" />
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[12px] leading-4 text-muted-foreground">{paused > 0 ? `${plural(paused, "hábito pausado não conta", "hábitos pausados não contam")}` : "Hábitos pausados não contam"}</p>
        <Button variant="outline" className="h-9 rounded-full px-4" disabled={future || rows.length === 0} onClick={onAdjust}>
          <PencilIcon strokeWidth={1.75} /> Ajustar registros
        </Button>
      </div>
    </BentoCard>
  )
}

/** Edit or add the check-ins of a past day with the same toggle and stepper as Hoje. */
function AdjustDialog({ open, onOpenChange, habits, logs, day, onToggle, onStep }: { open: boolean; onOpenChange: (open: boolean) => void; habits: HabitRow[]; logs: HabitLogRow[]; day: string; onToggle: (habit: HabitRow, day: string) => void; onStep: (habit: HabitRow, direction: 1 | -1, day: string) => void }) {
  const rows = dueOn(habits, day)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar registros</DialogTitle>
          <DialogDescription>{longDate(day)}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2" data-testid="history-adjust">
          {rows.map((habit) => {
            const qty = logs.find((l) => l.habit_id === habit.id && l.log_date === day)?.qty ?? 0
            return (
              <li key={habit.id} className={cn(LIST_CARD, "flex items-center gap-3 p-3")}>
                <Lead habit={habit} done={isDone(habit, logs, day)} qty={qty} disabled={false} onToggle={() => onToggle(habit, day)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] leading-5 font-semibold">{habit.name}</p>
                  {habit.type === "goal" ? <p className="tabular text-[13px] leading-5 text-muted-foreground">{formatQty(qty)} / {formatQty(habit.target_qty ?? 0)} {habit.unit}</p> : null}
                </div>
                {habit.type === "goal" ? <Stepper habit={habit} qty={qty} disabled={false} onStep={(d) => onStep(habit, d, day)} /> : null}
              </li>
            )
          })}
        </ul>
        <Button className="h-11 rounded-full" onClick={() => onOpenChange(false)}>
          Pronto
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ per habit, last 4 weeks

function summaryOf(habit: HabitRow, logs: HabitLogRow[], today: string, count: number) {
  const strip = dayStrip(habit, logs, today, count)
  const scheduled = strip.filter((s) => s.state !== "off").length
  const done = strip.filter((s) => s.state === "done").length
  return { strip, label: `${done} de ${scheduled} dias feitos` }
}

function StreakMeta({ streak }: { streak: number }) {
  return streak > 0 ? (
    <span className="tabular inline-flex items-center gap-1">
      <FlameIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
      {plural(streak, "dia seguido", "dias seguidos")}
    </span>
  ) : (
    <span>Sem sequência</span>
  )
}

function HabitsCard({ habits, logs, today, isMobile }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; isMobile: boolean }) {
  const active = habits.filter((h) => !h.paused)
  const average = averageRate(active, logs, today)
  const starts = blockStarts(today)
  return (
    <BentoCard title="Por hábito · últimas 4 semanas" data-testid="history-habits" actions={<span data-chip className="tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground">média {average}%</span>}>
      {active.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhum hábito ativo.</p> : null}
      {isMobile ? (
        <ul className="flex flex-col gap-2">
          {active.map((habit) => {
            const rate = windowRate(habit, logs, today)
            const { strip, label } = summaryOf(habit, logs, today, 14)
            return (
              <li key={habit.id} data-habit={habit.id} className={cn(LIST_CARD, "flex flex-col gap-3 p-3")}>
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
                    <HabitGlyph name={habit.name} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] leading-5 font-semibold">{habit.name}</p>
                    <p className="tabular text-[13px] leading-5 text-muted-foreground">{rate}% nas 4 semanas</p>
                  </div>
                  {currentStreak(habit, logs, today) > 0 ? <StatusChip icon={FlameIcon}>{plural(currentStreak(habit, logs, today), "dia", "dias")}</StatusChip> : null}
                </div>
                <div className="flex flex-col gap-1">
                  <div role="img" aria-label={`Últimos 14 dias de ${habit.name}: ${label}`} data-strip className="grid grid-cols-14 gap-0.5">
                    {strip.map(({ day, state }) => (
                      <span key={day} className="flex justify-center">
                        <DayDot state={state} size="size-5" />
                      </span>
                    ))}
                  </div>
                  <p aria-hidden className="tabular flex justify-between text-[11px] leading-4 text-muted-foreground">
                    <span>{format(parseISO(strip[0].day), "dd/MM")}</span>
                    <span>hoje</span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col gap-1">
          {active.length > 0 ? (
            <div aria-hidden className="grid grid-cols-[36px_minmax(0,200px)_minmax(0,1fr)_44px] items-end gap-x-3">
              <span className="col-start-3 flex gap-4">
                {starts.map((start) => (
                  <span key={start} className="tabular min-w-0 flex-1 text-[12px] leading-4 text-muted-foreground">
                    {format(parseISO(start), "dd/MM")}
                  </span>
                ))}
              </span>
            </div>
          ) : null}
          <ul className="flex flex-col divide-y divide-border">
            {active.map((habit) => {
              const rate = windowRate(habit, logs, today)
              const { strip, label } = summaryOf(habit, logs, today, 28)
              return (
                <li key={habit.id} data-habit={habit.id} className="grid grid-cols-[36px_minmax(0,200px)_minmax(0,1fr)_44px] items-center gap-x-3 py-3">
                  <span aria-hidden className="flex size-9 items-center justify-center rounded-full border border-border">
                    <HabitGlyph name={habit.name} className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] leading-5 font-semibold">{habit.name}</p>
                    <p className="text-[13px] leading-5 text-muted-foreground">
                      <StreakMeta streak={currentStreak(habit, logs, today)} />
                    </p>
                  </div>
                  <div role="img" aria-label={`Últimas 4 semanas de ${habit.name}: ${label}`} data-strip className="flex gap-4">
                    {[0, 1, 2, 3].map((block) => (
                      <div key={block} className="grid min-w-0 flex-1 grid-cols-7 justify-items-center gap-1">
                        {strip.slice(block * 7, block * 7 + 7).map(({ day, state }) => (
                          <DayDot key={day} state={state} size="aspect-square w-full max-w-6" />
                        ))}
                      </div>
                    ))}
                  </div>
                  <span className="tabular text-right text-[14px] leading-5 font-semibold">{rate}%</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </BentoCard>
  )
}

// ------------------------------------------------------------------ the tab

export function HistoricoTab({ habits, logs, today, habitId, month, mode, onMode, day, onDay, isMobile, onToggle, onStep }: { habits: HabitRow[]; logs: HabitLogRow[]; today: string; habitId: string; month: string; mode: HistoryMode; onMode: (mode: HistoryMode) => void; day: string; onDay: (day: string) => void; isMobile: boolean; onToggle: (habit: HabitRow, day: string) => void; onStep: (habit: HabitRow, direction: 1 | -1, day: string) => void }) {
  const [adjusting, setAdjusting] = useState(false)
  const scope = habitId === "all" ? habits : habits.filter((h) => h.id === habitId)
  const scheduledThatDay = scope.filter((h) => !h.paused && isScheduled(h, day))
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="rotina-historico">
      <div className="@container min-w-0">
        <div className="grid min-w-0 grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
          <div className="min-w-0 @min-[880px]:col-span-8">
            <CalendarCard habits={habits} logs={logs} today={today} habitId={habitId} month={month} mode={mode} selected={day} onSelect={onDay} onMode={onMode} isMobile={isMobile} />
          </div>
          <div className="min-w-0 @min-[880px]:col-span-4">
            <DetailCard habits={habits} logs={logs} today={today} habitId={habitId} day={day} onAdjust={() => setAdjusting(true)} />
          </div>
        </div>
      </div>
      <HabitsCard habits={scope} logs={logs} today={today} isMobile={isMobile} />
      <AdjustDialog open={adjusting} onOpenChange={setAdjusting} habits={scheduledThatDay} logs={logs} day={day} onToggle={onToggle} onStep={onStep} />
    </div>
  )
}
