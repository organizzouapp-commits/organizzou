"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, addMonths, addWeeks, endOfWeek, format, getDaysInMonth, parseISO, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarClockIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"

import { formatTime } from "@/components/calendar/agenda-screen"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { resolveHex, taskColorOf } from "@/features/tasks/colors"
import type { TaskView } from "@/features/tasks/types"
import { dayKey, inTz, toDueIso } from "@/lib/dates"
import { cn } from "@/lib/utils"

import { useLabelColors } from "./label-colors-context"
import { TaskCardBody, type TaskActions } from "./task-card"
import type { ViewProps } from "./types"

type Mode = "dia" | "semana"

export type MobileCalendarProps = ViewProps & {
  day: string
  onDayChange: (day: string) => void
  /** Moves a task to a day (all day) or to a date and time. */
  onSchedule: (task: TaskView, dueIso: string, hasTime: boolean) => void
}

const STORAGE_KEY = "organizzou:tarefas-calendar"
const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"
const CELL = 44
const lower = (text: string) => text.toLowerCase()

type Prefs = { monthOpen: boolean; hideDone: boolean }

function readPrefs(): Prefs {
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Prefs>
    return { monthOpen: data.monthOpen !== false, hideDone: data.hideDone === true }
  } catch {
    return { monthOpen: true, hideDone: false }
  }
}

function savePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode: the choice just does not survive the visit.
  }
}

/** Week order comes from the app's calendar (Sunday first, as in the Agenda). */
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"]

function useSwipe(onSwipe: (direction: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1)
    },
    onPointerCancel: () => {
      start.current = null
    },
  }
}

/** The month, or a single week strip when collapsed (same grid, shown through a 44 px window). */
function MonthCard({
  day,
  todayKey,
  monthOpen,
  onToggle,
  onDay,
  tasksOn,
  onShift,
  onMonthSheet,
  onToday,
}: {
  day: string
  todayKey: string
  monthOpen: boolean
  onToggle: () => void
  onDay: (day: string) => void
  tasksOn: (key: string) => TaskView[]
  onShift: (direction: -1 | 1) => void
  onMonthSheet: () => void
  onToday: () => void
}) {
  const labels = useLabelColors()
  const [direction, setDirection] = useState<-1 | 1>(1)
  const selected = parseISO(day)
  const first = startOfWeek(startOfMonth(selected))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const selectedRow = Math.max(0, Math.floor(cells.findIndex((d) => format(d, "yyyy-MM-dd") === day) / 7))
  const swipe = useSwipe((dir) => {
    setDirection(dir)
    onShift(dir)
  })
  const drag = useRef<number | null>(null)

  return (
    <section aria-label="Calendário" data-testid="calendar-card" className="rounded-[20px] border border-border bg-card p-4">
      <div className="flex h-11 items-center gap-0.5">
        <button
          type="button"
          onClick={onMonthSheet}
          aria-label={`Escolher mês: ${lower(format(selected, "MMMM yyyy", { locale: ptBR }))}`}
          className="-ml-2 flex h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-left text-[16px] leading-6 font-semibold outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="truncate" data-testid="month-title">
            {lower(format(selected, "MMMM yyyy", { locale: ptBR }))}
          </span>
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <span className="min-w-0 flex-1" />
        <Button type="button" variant="outline" className="h-11 px-3.5" onClick={onToday}>
          Hoje
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={monthOpen ? "Mês anterior" : "Semana anterior"} className="size-11" onClick={() => (setDirection(-1), onShift(-1))}>
          <ChevronLeftIcon strokeWidth={1.75} />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={monthOpen ? "Próximo mês" : "Próxima semana"} className="size-11" onClick={() => (setDirection(1), onShift(1))}>
          <ChevronRightIcon strokeWidth={1.75} />
        </Button>
      </div>

      <div role="row" aria-hidden className="mt-1 grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="flex h-8 items-center justify-center text-[13px] font-medium text-muted-foreground">
            {w}
          </span>
        ))}
      </div>

      <div
        {...swipe}
        data-testid="month-window"
        data-open={monthOpen}
        className={cn("touch-pan-y overflow-hidden transition-[height] duration-[400ms] motion-reduce:transition-none", EASE)}
        style={{ height: monthOpen ? CELL * 6 : CELL }}
      >
        <div
          key={format(selected, "yyyy-MM")}
          role="grid"
          aria-label={`Dias de ${lower(format(selected, "MMMM yyyy", { locale: ptBR }))}`}
          className={cn("grid grid-cols-7 transition-transform duration-[400ms] motion-reduce:transition-none", EASE, "animate-in fade-in-0 duration-[400ms] motion-reduce:animate-none", direction === 1 ? "slide-in-from-right-6" : "slide-in-from-left-6")}
          style={{ transform: monthOpen ? undefined : `translateY(${-selectedRow * CELL}px)` }}
        >
          {cells.map((date) => {
            const key = format(date, "yyyy-MM-dd")
            const inMonth = date.getMonth() === selected.getMonth()
            const isSelected = key === day
            const isToday = key === todayKey
            const dots = tasksOn(key).slice(0, 3)
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                data-day={key}
                aria-selected={isSelected}
                aria-label={`${format(date, "d 'de' MMMM", { locale: ptBR })}${dots.length ? `, ${tasksOn(key).length} ${tasksOn(key).length === 1 ? "tarefa" : "tarefas"}` : ""}`}
                tabIndex={monthOpen || key === day || Math.floor(cells.indexOf(date) / 7) === selectedRow ? 0 : -1}
                onClick={() => onDay(key)}
                className={cn("relative flex size-11 flex-col items-center justify-center gap-0.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50", !inMonth && "opacity-40")}
              >
                <span
                  className={cn(
                    "tabular flex size-9 items-center justify-center rounded-full text-[15px] leading-5",
                    isSelected ? "bg-highlight font-semibold text-highlight-foreground" : "text-foreground",
                    isToday && !isSelected && "ring-[1.5px] ring-foreground"
                  )}
                >
                  {date.getDate()}
                </span>
                <span aria-hidden data-dots className="pointer-events-none absolute bottom-0.5 flex h-[5px] items-center gap-[3px]">
                  {dots.map((task) => {
                    const hex = resolveHex(taskColorOf(labels.state, task))
                    return <span key={task.id} data-dot={hex ?? "neutral"} className={cn("size-[5px] rounded-full", hex ? "" : "bg-foreground/50")} style={hex ? { backgroundColor: hex } : undefined} />
                  })}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* The handle: tap or drag up to fold the month into a week strip, down to unfold. */}
      <button
        type="button"
        aria-expanded={monthOpen}
        aria-label={monthOpen ? "Recolher o mês" : "Expandir o mês"}
        data-testid="calendar-grabber"
        onPointerDown={(e) => (drag.current = e.clientY)}
        onPointerUp={(e) => {
          const from = drag.current
          drag.current = null
          if (from === null) return
          const dy = e.clientY - from
          if (dy < -20 && monthOpen) onToggle()
          else if (dy > 20 && !monthOpen) onToggle()
          else if (Math.abs(dy) <= 20) onToggle()
        }}
        onClick={(e) => {
          // Keyboard activation only: pointer taps are handled above.
          if (e.detail === 0) onToggle()
        }}
        className="relative mx-auto mt-1 -mb-2 flex h-6 w-24 touch-none items-center justify-center rounded-full outline-none after:absolute after:-inset-y-2.5 after:inset-x-0 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span aria-hidden className="h-1 w-9 rounded-full bg-foreground/25" />
      </button>
    </section>
  )
}

function MonthYearSheet({ open, onOpenChange, day, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; day: string; onPick: (day: string) => void }) {
  const selected = parseISO(day)
  const [year, setYear] = useState(selected.getFullYear())
  useEffect(() => {
    // The sheet reopens on the year being looked at.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setYear(selected.getFullYear())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Escolher mês</DrawerTitle>
          <DrawerDescription className="sr-only">Escolha o mês e o ano do calendário.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon" aria-label="Ano anterior" className="size-11" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeftIcon strokeWidth={1.75} />
            </Button>
            <span className="tabular text-[17px] font-semibold" aria-live="polite">
              {year}
            </span>
            <Button type="button" variant="ghost" size="icon" aria-label="Próximo ano" className="size-11" onClick={() => setYear((y) => y + 1)}>
              <ChevronRightIcon strokeWidth={1.75} />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, month) => {
              const current = month === selected.getMonth() && year === selected.getFullYear()
              return (
                <Button
                  key={month}
                  type="button"
                  variant={current ? "default" : "outline"}
                  aria-pressed={current}
                  className="h-11"
                  onClick={() => {
                    const base = new Date(year, month, 1)
                    onPick(format(new Date(year, month, Math.min(selected.getDate(), getDaysInMonth(base))), "yyyy-MM-dd"))
                    onOpenChange(false)
                  }}
                >
                  {lower(format(new Date(2026, month, 1), "MMM", { locale: ptBR })).replace(".", "")}
                </Button>
              )
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function ScheduleSheet({ task, open, onOpenChange, todayKey, timeZone, onConfirm }: { task: TaskView | null; open: boolean; onOpenChange: (open: boolean) => void; todayKey: string; timeZone: string; onConfirm: (task: TaskView, day: string, time: string | null) => void }) {
  const [date, setDate] = useState(todayKey)
  const [time, setTime] = useState("")
  useEffect(() => {
    if (!open || !task) return
    // Starts on the task's own day when it has one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(task.due_at ? dayKey(task.due_at, timeZone) : todayKey)
    setTime(task.due_at && task.due_has_time ? format(inTz(task.due_at, timeZone), "HH:mm") : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id])
  const tomorrow = format(addDays(parseISO(todayKey), 1), "yyyy-MM-dd")
  const nextWeek = format(addDays(parseISO(todayKey), 7), "yyyy-MM-dd")
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Agendar</DrawerTitle>
          <DrawerDescription className="line-clamp-2">{task?.title}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div role="group" aria-label="Atalhos de data" className="flex flex-wrap gap-2">
            {[
              { id: todayKey, label: "Hoje" },
              { id: tomorrow, label: "Amanhã" },
              { id: nextWeek, label: "Próxima semana" },
            ].map((chip) => (
              <Button key={chip.label} type="button" variant={date === chip.id ? "default" : "outline"} aria-pressed={date === chip.id} className="h-11" onClick={() => setDate(chip.id)}>
                {chip.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              Dia
              <Input type="date" aria-label="Dia" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 rounded-xl text-[15px] text-foreground" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              Hora (opcional)
              <Input type="time" step={300} aria-label="Hora" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-xl text-[15px] text-foreground" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={() => {
                if (task) onConfirm(task, date, time || null)
                onOpenChange(false)
              }}
            >
              Agendar
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

const hourOf = (task: TaskView, timeZone: string) => inTz(task.due_at!, timeZone).getHours()

/** The calendar on phones: month card (collapsible), day summary, then the day's (or week's) tasks and "Sem data". */
export function MobileCalendar(props: MobileCalendarProps) {
  const { tasks, now, timeZone, day, onDayChange, onSchedule, onCreate, actionsFor } = props
  const todayKey = dayKey(now, timeZone)
  const [prefs, setPrefs] = useState<Prefs>({ monthOpen: true, hideDone: false })
  const [mode, setMode] = useState<Mode>("dia")
  const [undatedOpen, setUndatedOpen] = useState(false)
  const [monthSheet, setMonthSheet] = useState(false)
  const [scheduling, setScheduling] = useState<TaskView | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // localStorage only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(readPrefs())
  }, [])
  const changePrefs = (patch: Partial<Prefs>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch }
      savePrefs(next)
      return next
    })

  const dated = useMemo(() => tasks.filter((t) => t.due_at), [tasks])
  const byDay = useMemo(() => {
    const map = new Map<string, TaskView[]>()
    for (const task of dated) {
      const key = dayKey(task.due_at!, timeZone)
      map.set(key, [...(map.get(key) ?? []), task])
    }
    for (const list of map.values()) list.sort((a, b) => Number(a.due_has_time) - Number(b.due_has_time) || new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    return map
  }, [dated, timeZone])
  const visibleOn = (key: string) => (byDay.get(key) ?? []).filter((t) => !(prefs.hideDone && t.completed_at))
  const undated = useMemo(() => tasks.filter((t) => !t.due_at && !(prefs.hideDone && t.completed_at)), [tasks, prefs.hideDone])

  const selected = parseISO(day)
  const tomorrowKey = format(addDays(parseISO(todayKey), 1), "yyyy-MM-dd")
  const weekStart = startOfWeek(selected)
  const weekKeys = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"))
  const scope = mode === "dia" ? [day] : weekKeys
  const scoped = scope.flatMap((key) => byDay.get(key) ?? [])
  const doneCount = scoped.filter((t) => t.completed_at).length
  const heading = day === todayKey ? "Hoje" : day === tomorrowKey ? "Amanhã" : lower(format(selected, "EEE, d 'de' MMMM", { locale: ptBR }))

  function shift(direction: -1 | 1) {
    onDayChange(format(prefs.monthOpen ? addMonths(selected, direction) : addWeeks(selected, direction), "yyyy-MM-dd"))
  }

  const schedulable = (task: TaskView): TaskActions => ({ ...actionsFor(task), schedule: () => setScheduling(task) })

  function confirmSchedule(task: TaskView, dayChosen: string, time: string | null) {
    // The board shows the "Tarefa reagendada." toast with Desfazer (it restores the previous date, or none).
    onSchedule(task, toDueIso(dayChosen, time, timeZone), Boolean(time))
  }

  const row = (task: TaskView, extra?: { firstUpcoming?: boolean }) => (
    <div key={task.id} data-first-upcoming={extra?.firstUpcoming ? "" : undefined} className="flex items-start gap-1">
      <span data-time-col className="tabular w-12 shrink-0 pt-[18px] text-[13px] leading-5 text-muted-foreground">
        {task.due_has_time ? formatTime(new Date(task.due_at!)) : ""}
      </span>
      <div className="min-w-0 flex-1">
        <TaskCardBody anchor task={task} tags={props.tags} now={now} timeZone={timeZone} actions={schedulable(task)} selecting={props.selection.active} selected={props.selection.ids.has(task.id)} onSelect={() => props.selection.toggle(task.id)} />
      </div>
    </div>
  )

  // Day groups: tasks without a time first, then Manhã (before 12:00), Tarde (12:00-17:59), Noite (18:00 and later).
  const dayTasks = visibleOn(day)
  const groups = [
    { id: "sem-horario", label: "Sem horário", tasks: dayTasks.filter((t) => !t.due_has_time) },
    { id: "manha", label: "Manhã", tasks: dayTasks.filter((t) => t.due_has_time && hourOf(t, timeZone) < 12) },
    { id: "tarde", label: "Tarde", tasks: dayTasks.filter((t) => t.due_has_time && hourOf(t, timeZone) >= 12 && hourOf(t, timeZone) < 18) },
    { id: "noite", label: "Noite", tasks: dayTasks.filter((t) => t.due_has_time && hourOf(t, timeZone) >= 18) },
  ].filter((g) => g.tasks.length > 0)
  const isToday = day === todayKey
  const timed = dayTasks.filter((t) => t.due_has_time)
  const firstUpcoming = isToday ? timed.find((t) => new Date(t.due_at!).getTime() >= now.getTime()) : undefined
  const lastTimed = timed[timed.length - 1]
  const nowLabel = formatTime(now)
  const nowDivider = (
    <div key="now" role="separator" aria-label={`Agora, ${nowLabel}`} data-now-divider className="flex items-center gap-2 py-1 pl-1">
      <span className="tabular w-11 shrink-0 text-[12px] leading-4 font-medium text-foreground">{nowLabel}</span>
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-foreground" />
      <span aria-hidden className="h-px flex-1 bg-foreground/40" />
      <span className="text-[12px] leading-4 text-muted-foreground">agora</span>
    </div>
  )

  useEffect(() => {
    if (!isToday || mode !== "dia") return
    listRef.current?.querySelector<HTMLElement>("[data-first-upcoming]")?.scrollIntoView({ block: "nearest" })
    // Once, when the screen opens on today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-5" data-testid="tasks-calendar">
      <MonthCard
        day={day}
        todayKey={todayKey}
        monthOpen={prefs.monthOpen}
        onToggle={() => changePrefs({ monthOpen: !prefs.monthOpen })}
        onDay={onDayChange}
        tasksOn={visibleOn}
        onShift={shift}
        onMonthSheet={() => setMonthSheet(true)}
        onToday={() => onDayChange(todayKey)}
      />

      <section aria-label="Resumo do dia" className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 data-testid="day-heading" className="truncate text-[20px] leading-7 font-semibold tracking-[-0.01em]">
              {mode === "dia" ? heading : `${format(weekStart, "d MMM", { locale: ptBR })} – ${format(endOfWeek(weekStart), "d MMM", { locale: ptBR })}`}
            </h2>
            <p className="text-[13px] leading-5 text-muted-foreground">{mode === "dia" ? lower(format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })) : "semana da data escolhida"}</p>
          </div>
          <div role="tablist" aria-label="Visão do dia" className="flex h-11 shrink-0 items-center gap-0.5 rounded-full bg-muted p-0.5">
            {(["dia", "semana"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn("h-full rounded-full px-4 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50", mode === m ? "bg-foreground/14 font-semibold text-foreground" : "text-muted-foreground")}
              >
                {m === "dia" ? "Dia" : "Semana"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p data-testid="day-count" className="text-[13px] leading-5 text-muted-foreground">
            {scoped.length} {scoped.length === 1 ? "tarefa" : "tarefas"} · {doneCount} {doneCount === 1 ? "concluída" : "concluídas"}
          </p>
          <Button type="button" variant={prefs.hideDone ? "default" : "outline"} aria-pressed={prefs.hideDone} className="h-11 shrink-0 px-4 text-[13px]" onClick={() => changePrefs({ hideDone: !prefs.hideDone })}>
            Ocultar concluídas
          </Button>
        </div>
      </section>

      <div ref={listRef} className="flex flex-col gap-4" data-testid="day-list">
        {mode === "dia" ? (
          groups.length === 0 ? (
            <div data-testid="day-empty" className="flex flex-col items-center gap-3 py-8 text-center">
              <CalendarClockIcon aria-hidden strokeWidth={1.75} className="size-8 text-muted-foreground" />
              <p className="text-[15px] leading-6 text-muted-foreground">Nada para este dia</p>
              <Button type="button" variant="outline" className="h-11 border-dashed px-5" onClick={() => onCreate(undefined, day)}>
                <PlusIcon strokeWidth={1.75} /> Adicionar tarefa
              </Button>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.id} aria-label={group.label} data-group={group.id} className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 px-1 text-[13px] leading-5 font-medium text-muted-foreground">
                  {group.label}
                  <span className="tabular rounded-full bg-muted px-2 text-[12px] leading-5">{group.tasks.length}</span>
                </h3>
                {group.tasks.map((task) => (
                  <div key={task.id} className="flex flex-col gap-2">
                    {isToday && firstUpcoming?.id === task.id ? nowDivider : null}
                    {row(task, { firstUpcoming: firstUpcoming?.id === task.id })}
                    {isToday && !firstUpcoming && lastTimed?.id === task.id ? nowDivider : null}
                  </div>
                ))}
              </section>
            ))
          )
        ) : (
          weekKeys.map((key) => {
            const list = visibleOn(key)
            return (
              <section key={key} aria-label={key} data-week-day={key} className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 px-1 text-[13px] leading-5 font-medium text-muted-foreground">
                  {lower(format(parseISO(key), "EEE, d MMM", { locale: ptBR }))} · {list.length}
                </h3>
                {list.map((task) => row(task))}
              </section>
            )
          })
        )}
      </div>

      <section className="flex flex-col gap-2" aria-label="Sem data">
        <button
          type="button"
          aria-expanded={undatedOpen}
          onClick={() => setUndatedOpen((v) => !v)}
          className="-ml-2 flex min-h-11 w-fit items-center gap-2 rounded-full px-3 text-left text-[15px] font-semibold outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Sem data · {undated.length}
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", EASE, !undatedOpen && "-rotate-90")} />
        </button>
        <div inert={!undatedOpen} className={cn("grid transition-[grid-template-rows] duration-[400ms] motion-reduce:transition-none", EASE, undatedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="min-h-0 overflow-hidden">
            <div data-testid="undated-tray" className="flex flex-col gap-2">
              {undated.length === 0 ? <p className="px-1 py-2 text-[13px] leading-5 text-muted-foreground">Todas as tarefas têm data.</p> : null}
              {undated.map((task) => (
                <TaskCardBody key={task.id} anchor task={task} tags={props.tags} now={now} timeZone={timeZone} actions={schedulable(task)} selecting={props.selection.active} selected={props.selection.ids.has(task.id)} onSelect={() => props.selection.toggle(task.id)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <MonthYearSheet open={monthSheet} onOpenChange={setMonthSheet} day={day} onPick={onDayChange} />
      <ScheduleSheet task={scheduling} open={Boolean(scheduling)} onOpenChange={(open) => !open && setScheduling(null)} todayKey={todayKey} timeZone={timeZone} onConfirm={confirmSchedule} />
    </div>
  )
}

