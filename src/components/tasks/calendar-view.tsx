"use client"

import { useMemo, useRef, useState } from "react"
import { addDays, addMonths, addWeeks, eachDayOfInterval, format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarPlusIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { BentoCard, bentoCardClass } from "@/components/organizzou/Bento"
import { DayStrip, formatTime, MiniMonth, MonthGrid, TimeGrid } from "@/components/calendar/agenda-screen"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AgendaItem } from "@/features/calendar/types"
import { dayKey, toDueIso } from "@/lib/dates"
import type { SwatchId } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import type { TaskView } from "@/features/tasks/types"

import type { ViewProps } from "./types"

type View = "mes" | "semana" | "dia"

type CalendarViewProps = ViewProps & {
  nowIso: string
  /** Moves a task to a day (all day) or to a date and time. */
  onSchedule: (task: TaskView, dueIso: string, hasTime: boolean) => void
}

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The selected day's tasks: time, checkbox, title. The checkbox completes; the title opens the same pop-up as everywhere. */
function DayTasks({ items, tasks, onToggle, onOpen }: { items: AgendaItem[]; tasks: Map<string, TaskView>; onToggle: (task: TaskView) => void; onOpen: (id: string) => void }) {
  if (items.length === 0) return <p className="py-3 text-[15px] leading-6 text-muted-foreground">Nenhuma tarefa neste dia.</p>
  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const task = tasks.get(item.id)
        if (!task) return null
        const done = Boolean(task.completed_at)
        return (
          <li key={item.key} className="flex min-h-12 items-center gap-3 border-b border-border last:border-b-0">
            <span className="tabular w-14 shrink-0 text-[13px] leading-5 whitespace-nowrap text-muted-foreground">{item.allDay ? "Dia todo" : formatTime(item.start)}</span>
            <span className="flex size-11 shrink-0 items-center justify-center md:size-7">
              <Checkbox checked={done} onCheckedChange={() => onToggle(task)} aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`} className="size-5 after:-inset-3" />
            </span>
            <button type="button" onClick={() => onOpen(task.id)} className={cn("min-w-0 flex-1 truncate rounded-md py-2 text-left text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50", done && "text-muted-foreground line-through")}>
              {task.title}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Tasks without a date. Each one can be scheduled onto the selected day, today or tomorrow from its menu. */
function UndatedTray({ tasks, day, todayKey, onSchedule, onOpen }: { tasks: TaskView[]; day: string; todayKey: string; onSchedule: (task: TaskView, key: string) => void; onOpen: (id: string) => void }) {
  if (tasks.length === 0) return <p className="py-3 text-[15px] leading-6 text-muted-foreground">Todas as tarefas têm data.</p>
  const tomorrow = format(addDays(parseISO(todayKey), 1), "yyyy-MM-dd")
  return (
    <ul className="flex flex-col" data-testid="undated-tray">
      {tasks.map((task) => (
        <li key={task.id} className="flex min-h-12 items-center gap-2 border-b border-border last:border-b-0">
          <button type="button" onClick={() => onOpen(task.id)} className="min-w-0 flex-1 truncate rounded-md py-2 text-left text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {task.title}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Agendar ${task.title}`} className="size-11 rounded-full md:size-9">
                <CalendarPlusIcon strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52 rounded-2xl p-2">
              <DropdownMenuItem className="min-h-11 rounded-xl px-3 text-[15px]" onSelect={() => onSchedule(task, day)}>
                No dia {format(parseISO(day), "d 'de' MMM", { locale: ptBR })}
              </DropdownMenuItem>
              {day !== todayKey ? (
                <DropdownMenuItem className="min-h-11 rounded-xl px-3 text-[15px]" onSelect={() => onSchedule(task, todayKey)}>
                  Hoje
                </DropdownMenuItem>
              ) : null}
              {day !== tomorrow ? (
                <DropdownMenuItem className="min-h-11 rounded-xl px-3 text-[15px]" onSelect={() => onSchedule(task, tomorrow)}>
                  Amanhã
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  )
}

/**
 * Calendário = the Agenda's own calendar parts (MonthGrid, TimeGrid, MiniMonth, DayStrip) fed with this quadro's tasks (filters
 * applied). Desktop: Mês/Semana/Dia + a 320 px rail with the mini month, the selected day and the "Sem data" tray. Phones: a swipeable
 * week strip with the day's list, a collapsible month and a collapsible "Sem data".
 */
export function CalendarView({ tasks, now, nowIso, timeZone, onOpenTask, onToggleComplete, onCreate, onSchedule }: CalendarViewProps) {
  const isMobile = useIsMobile()
  const todayKey = dayKey(now, timeZone)
  const [view, setView] = useState<View>("semana")
  const [day, setDay] = useState(todayKey)
  const [monthOpen, setMonthOpen] = useState(false)
  const [undatedOpen, setUndatedOpen] = useState(false)
  const swipe = useRef<number | null>(null)

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const items = useMemo(
    () =>
      tasks
        .filter((t) => t.due_at)
        .map((t): AgendaItem => {
          const start = new Date(t.due_at!)
          return { key: `task:${t.id}`, kind: "task", id: t.id, title: t.title, start, end: new Date(start.getTime() + 30 * 60_000), allDay: !t.due_has_time, swatch: t.swatch as SwatchId, editable: false }
        }),
    [tasks]
  )
  const undated = useMemo(() => tasks.filter((t) => !t.due_at && !t.completed_at), [tasks])
  const itemsOn = (key: string) => items.filter((item) => dayKey(item.start, timeZone) === key).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())

  const weekStart = startOfWeek(parseISO(day))
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const mode: View = isMobile ? "semana" : view
  const title =
    mode === "mes"
      ? upperFirst(format(parseISO(day), "MMMM 'de' yyyy", { locale: ptBR }))
      : mode === "semana"
        ? `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM yyyy", { locale: ptBR })}`
        : upperFirst(format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }))

  function shift(direction: -1 | 1) {
    const date = parseISO(day)
    setDay(format(mode === "mes" ? addMonths(date, direction) : mode === "semana" ? addWeeks(date, direction) : addDays(date, direction), "yyyy-MM-dd"))
  }

  const schedule = (task: TaskView, key: string) => onSchedule(task, toDueIso(key, null, timeZone), false)
  const toggle = (task: TaskView) => onToggleComplete(task)
  const selectedTitle = upperFirst(format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }))

  const controls = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" className="h-11 rounded-full md:h-10" onClick={() => setDay(todayKey)}>
          Hoje
        </Button>
        <Button variant="ghost" size="icon" aria-label="Anterior" className="size-11 rounded-full md:size-10" onClick={() => shift(-1)}>
          <ChevronLeftIcon strokeWidth={1.75} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Próximo" className="size-11 rounded-full md:size-10" onClick={() => shift(1)}>
          <ChevronRightIcon strokeWidth={1.75} />
        </Button>
      </div>
      <h2 className="min-w-0 flex-1 truncate text-xl leading-7 font-semibold tracking-[-0.01em]">{title}</h2>
      {isMobile ? null : (
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList aria-label="Visão do calendário">
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="dia">Dia</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </div>
  )

  const month = <MiniMonth month={parseISO(day)} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} onShift={(n) => setDay(format(addMonths(parseISO(day), n), "yyyy-MM-dd"))} />

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4" data-testid="tasks-calendar">
        {controls}
        <div
          className="touch-pan-y"
          onPointerDown={(e) => (swipe.current = e.clientX)}
          onPointerUp={(e) => {
            if (swipe.current !== null && Math.abs(e.clientX - swipe.current) > 50) shift(e.clientX < swipe.current ? 1 : -1)
            swipe.current = null
          }}
          onPointerCancel={() => (swipe.current = null)}
        >
          <DayStrip days={weekDays} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} />
        </div>
        <section aria-label={selectedTitle} className="flex flex-col gap-1">
          <h3 className="text-[15px] leading-6 font-semibold">{selectedTitle}</h3>
          <DayTasks items={itemsOn(day)} tasks={byId} onToggle={toggle} onOpen={onOpenTask} />
        </section>
        <section className="flex flex-col">
          <button type="button" aria-expanded={monthOpen} onClick={() => setMonthOpen((v) => !v)} className="flex min-h-11 items-center gap-2 rounded-xl text-left text-[15px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 transition-transform duration-[400ms] motion-reduce:transition-none", !monthOpen && "-rotate-90")} /> Mês
          </button>
          {monthOpen ? month : null}
        </section>
        <section className="flex flex-col">
          <button type="button" aria-expanded={undatedOpen} onClick={() => setUndatedOpen((v) => !v)} className="flex min-h-11 items-center gap-2 rounded-xl text-left text-[15px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 transition-transform duration-[400ms] motion-reduce:transition-none", !undatedOpen && "-rotate-90")} /> Sem data
            <span className="tabular rounded-full bg-muted px-2 text-[12px] leading-5 font-medium">{undated.length}</span>
          </button>
          {undatedOpen ? <UndatedTray tasks={undated} day={day} todayKey={todayKey} onSchedule={schedule} onOpen={onOpenTask} /> : null}
        </section>
      </div>
    )
  }

  return (
    <div className="@container" data-testid="tasks-calendar">
      <div className="grid min-w-0 grid-cols-1 gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_320px] @min-[880px]:items-start">
        <div className={cn("flex min-w-0 flex-col gap-5", bentoCardClass())}>
          {controls}
          {mode === "mes" ? (
            <MonthGrid month={parseISO(day)} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} onOpenItem={(item) => onOpenTask(item.id)} onCreateOn={() => onCreate()} />
          ) : (
            <TimeGrid
              days={mode === "dia" ? [parseISO(day)] : weekDays}
              todayKey={todayKey}
              itemsOn={itemsOn}
              nowIso={nowIso}
              onOpenItem={(item) => onOpenTask(item.id)}
              onSelectDay={mode === "semana" ? (key) => (setDay(key), setView("dia")) : undefined}
              onCreate={() => onCreate()}
              onMoveEvent={(id, start) => {
                const task = byId.get(id)
                if (task) onSchedule(task, start.toISOString(), true)
              }}
              canDrag={(item) => !item.allDay}
              single={mode === "dia"}
            />
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-4" aria-label="Painel do calendário">
          <BentoCard title="Calendário">{month}</BentoCard>
          <BentoCard title={selectedTitle}>
            <DayTasks items={itemsOn(day)} tasks={byId} onToggle={toggle} onOpen={onOpenTask} />
          </BentoCard>
          <BentoCard title={`Sem data (${undated.length})`}>
            <UndatedTray tasks={undated} day={day} todayKey={todayKey} onSchedule={schedule} onOpen={onOpenTask} />
          </BentoCard>
        </aside>
      </div>
    </div>
  )
}
