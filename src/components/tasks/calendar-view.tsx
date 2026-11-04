"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addDays, addMonths, addWeeks, eachDayOfInterval, format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarClockIcon, ChevronDownIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { BentoCard, bentoCardClass } from "@/components/organizzou/Bento"
import { CalendarToolbar, DayStrip, MiniMonth, MonthGrid, TimeGrid, type CalendarViewId } from "@/components/calendar/agenda-screen"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AgendaItem } from "@/features/calendar/types"
import { resolveHex, taskColorOf } from "@/features/tasks/colors"
import type { TaskView } from "@/features/tasks/types"
import { dayKey, inTz, splitDue, toDueIso } from "@/lib/dates"
import { cn } from "@/lib/utils"

import { resolveMode, useCalendarPrefs } from "./calendar-store"
import { useLabelColors } from "./label-colors-context"
import { ListGroup } from "./list-view"
import type { NewTaskInput } from "./new-task-dialog"
import type { ListRow } from "@/features/tasks/types"
import { ScheduleSheet } from "./schedule-sheet"
import { TaskCardBody, type TaskActions } from "./task-card"
import type { ViewProps } from "./types"

type CalendarViewProps = ViewProps & {
  nowIso: string
  /** Moves a task to a day (all day) or to a date and time. */
  onSchedule: (task: TaskView, dueIso: string, hasTime: boolean) => void
  /** The selected day and view are reported up, so the app header's "+" can pre-fill them. */
  onContextChange?: (context: { day: string; view: CalendarViewId }) => void
  /** Creates a task (optimistic); resolves with it, or null when it failed. */
  onCreateTask: (input: NewTaskInput) => Promise<TaskView | null>
  /** The task that was just created: highlighted for ~1.2 s and shown even when a filter would hide it. */
  highlightId: string | null
  /** Opens the new-task dialog; `title` carries what was typed in the quick-add popover. */
  onCreate: (listId?: string, day?: string, time?: string, title?: string) => void
}

const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const lower = (text: string) => text.toLowerCase()
const hourOf = (task: TaskView, timeZone: string) => inTz(task.due_at!, timeZone).getHours()

function useSwipe(onSwipe: (direction: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      // Cards own their horizontal swipe (Concluir / Adiar).
      start.current = (e.target as HTMLElement).closest("[data-task-id], [role=grid], input, button") ? null : { x: e.clientX, y: e.clientY }
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

// ------------------------------------------------------------------ pieces

const countPill = "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[12px] leading-4 font-medium"

/** A collapsible group: 44px header (chevron left, name, count pill), height 0 when closed. */
function Group({ id, label, count, open, onToggle, children }: { id: string; label: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section data-group={id} aria-label={label} className="flex flex-col">
      <button
        type="button"
        data-group-header
        aria-expanded={open}
        onClick={onToggle}
        className="-ml-2 flex h-11 w-fit max-w-full items-center gap-2 rounded-full px-2 text-left text-[15px] font-semibold outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] motion-reduce:transition-none", EASE, !open && "-rotate-90")} />
        <span className="truncate">{label}</span>
        <span className={countPill}>{count}</span>
      </button>
      <div inert={!open} className={cn("grid transition-[grid-template-rows,visibility] duration-[400ms] motion-reduce:transition-none", EASE, open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  )
}

type CardsProps = { props: CalendarViewProps; actionsOf: (task: TaskView) => TaskActions; dueMode: "time" | "full" }

function Cards({ tasks, props, actionsOf, dueMode }: CardsProps & { tasks: TaskView[] }) {
  return (
    <div className="flex flex-col gap-2 pt-1 pb-2">
      {tasks.map((task) => (
        <div key={task.id} data-highlight={props.highlightId === task.id ? "" : undefined} className={cn("rounded-[14px] transition-shadow duration-[400ms] motion-reduce:transition-none", props.highlightId === task.id && "ring-2 ring-primary")}>
          <TaskCardBody anchor task={task} tags={props.tags} now={props.now} timeZone={props.timeZone} actions={actionsOf(task)} dueMode={dueMode} selecting={props.selection.active} selected={props.selection.ids.has(task.id)} onSelect={() => props.selection.toggle(task.id)} />
        </div>
      ))}
    </div>
  )
}

function AddPill({ onClick, label = "Adicionar tarefa" }: { onClick: () => void; label?: string }) {
  return (
    <Button type="button" variant="outline" data-testid="calendar-add-pill" className="h-11 w-full border-dashed" onClick={onClick}>
      <PlusIcon strokeWidth={1.75} /> {label}
    </Button>
  )
}

/** One day: Sem horário / Manhã / Tarde / Noite groups, the "agora" divider on today, the dashed "+ Adicionar tarefa" pill. */
function DayList({ day, tasks, props, actionsOf, isOpen, toggle, onAdd }: CardsProps & { day: string; tasks: TaskView[]; isOpen: (id: string, fallback?: boolean) => boolean; toggle: (id: string, fallback?: boolean) => void; onAdd: () => void }) {
  const { timeZone, now } = props
  const isToday = day === dayKey(now, timeZone)
  const timed = tasks.filter((t) => t.due_has_time)
  const groups = [
    { id: "sem-horario", label: "Sem horário", tasks: tasks.filter((t) => !t.due_has_time) },
    { id: "manha", label: "Manhã", tasks: timed.filter((t) => hourOf(t, timeZone) < 12) },
    { id: "tarde", label: "Tarde", tasks: timed.filter((t) => hourOf(t, timeZone) >= 12 && hourOf(t, timeZone) < 18) },
    { id: "noite", label: "Noite", tasks: timed.filter((t) => hourOf(t, timeZone) >= 18) },
  ].filter((g) => g.tasks.length > 0)
  const firstUpcoming = isToday ? timed.find((t) => new Date(t.due_at!).getTime() >= now.getTime()) : undefined
  const lastTimed = timed[timed.length - 1]
  const nowLabel = format(inTz(now, timeZone), "HH:mm")
  const divider = (
    <div role="separator" aria-label={`Agora, ${nowLabel}`} data-now-divider className="flex items-center gap-2 py-1">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-foreground" />
      <span aria-hidden className="h-px flex-1 bg-foreground/40" />
      <span className="tabular text-[12px] leading-4 text-muted-foreground">agora · {nowLabel}</span>
    </div>
  )

  if (tasks.length === 0) {
    return (
      <div data-testid="day-empty" className="flex flex-col items-center gap-3 py-6 text-center">
        <CalendarClockIcon aria-hidden strokeWidth={1.75} className="size-8 text-muted-foreground" />
        <p className="text-[15px] leading-6 text-muted-foreground">Nada para este dia</p>
        <AddPill onClick={onAdd} />
      </div>
    )
  }
  return (
    <div data-testid="day-list" className="flex flex-col">
      {groups.map((group) => (
        <Group key={group.id} id={group.id} label={group.label} count={group.tasks.length} open={isOpen(group.id, true)} onToggle={() => toggle(group.id, true)}>
          <div className="flex flex-col">
            {group.tasks.map((task) => (
              <div key={task.id}>
                {isToday && firstUpcoming?.id === task.id ? divider : null}
                <Cards tasks={[task]} props={props} actionsOf={actionsOf} dueMode="time" />
                {isToday && !firstUpcoming && lastTimed?.id === task.id ? divider : null}
              </div>
            ))}
          </div>
        </Group>
      ))}
      <div className="pt-2">
        <AddPill onClick={onAdd} />
      </div>
    </div>
  )
}

/** "Sem data · N": collapsed by default, tasks draggable onto the desktop grid, "Agendar…" in the menu. */
function Undated({ tasks, props, actionsOf, isOpen, toggle, draggable }: CardsProps & { tasks: TaskView[]; isOpen: (id: string, fallback?: boolean) => boolean; toggle: (id: string, fallback?: boolean) => void; draggable?: boolean }) {
  const open = isOpen("sem-data", false)
  return (
    <div data-testid="undated-tray">
      <Group id="sem-data" label="Sem data" count={tasks.length} open={open} onToggle={() => toggle("sem-data", false)}>
        {tasks.length === 0 ? <p className="px-1 py-2 text-[13px] leading-5 text-muted-foreground">Todas as tarefas têm data.</p> : null}
        <div className="flex flex-col gap-2 pt-1 pb-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              draggable={draggable}
              onDragStart={(e) => e.dataTransfer.setData("application/x-organizzou-task", task.id)}
              className={cn("rounded-[14px]", props.highlightId === task.id && "ring-2 ring-primary")}
            >
              <TaskCardBody anchor task={task} tags={props.tags} now={props.now} timeZone={props.timeZone} actions={actionsOf(task)} dueMode="time" selecting={props.selection.active} selected={props.selection.ids.has(task.id)} onSelect={() => props.selection.toggle(task.id)} />
            </div>
          ))}
        </div>
      </Group>
    </div>
  )
}

/** Agenda view: the next 30 days, one collapsible header per day with tasks ("qua, 4 nov · 3"): today open, the rest closed. */
function AgendaList({ from, byDay, todayKey, props, actionsOf, isOpen, toggle }: CardsProps & { from: string; byDay: (key: string) => TaskView[]; todayKey: string; isOpen: (id: string, fallback?: boolean) => boolean; toggle: (id: string, fallback?: boolean) => void }) {
  const days = Array.from({ length: 30 }, (_, i) => format(addDays(parseISO(from), i), "yyyy-MM-dd")).filter((key) => byDay(key).length > 0)
  if (days.length === 0) return <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nenhuma tarefa nos próximos 30 dias.</p>
  return (
    <div data-testid="agenda-list" className="flex flex-col">
      {days.map((key) => {
        const list = byDay(key)
        const id = `agenda:${key}`
        return (
          <Group key={key} id={id} label={lower(format(parseISO(key), "EEE, d MMM", { locale: ptBR })).replace(".", "")} count={list.length} open={isOpen(id, key === todayKey)} onToggle={() => toggle(id, key === todayKey)}>
            <Cards tasks={list} props={props} actionsOf={actionsOf} dueMode="time" />
          </Group>
        )
      })}
    </div>
  )
}

/** Desktop quick add: an anchored popover over the clicked cell or slot. Enter or leaving commits a non-empty title; Esc cancels. */
type QuickAddState = { anchor: DOMRect; day: string; time: string | null }

function QuickAdd({ state, props, onClose }: { state: QuickAddState | null; props: CalendarViewProps; onClose: () => void }) {
  const [title, setTitle] = useState("")
  const firstOpen = props.lists.find((l) => !l.is_done_list)?.id ?? props.lists[0]?.id ?? ""
  const [listId, setListId] = useState(firstOpen)
  const cancelled = useRef(false)
  const done = useRef(false)
  const anchorRef = useRef<{ getBoundingClientRect: () => DOMRect } | null>(null)
  useEffect(() => {
    if (!state) return
    anchorRef.current = { getBoundingClientRect: () => state.anchor }
    cancelled.current = false
    done.current = false
    // A fresh popover starts empty on the first open list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle("")
    setListId(firstOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.anchor, state?.day, state?.time])

  async function commit() {
    if (!state || done.current) return
    const value = title.trim()
    if (!value || cancelled.current) return
    done.current = true
    onClose()
    await props.onCreateTask({ listId, title: value, dueDay: state.day, dueTime: state.time })
  }

  if (!state) return null
  const label = `${lower(format(parseISO(state.day), "EEE, d 'de' MMM", { locale: ptBR }))}${state.time ? ` · ${state.time}` : ""}`
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (open) return
        void commit()
        onClose()
      }}
    >
      <PopoverAnchor virtualRef={anchorRef as React.RefObject<{ getBoundingClientRect: () => DOMRect }>} />
      <PopoverContent
        data-testid="calendar-quick-add"
        align="start"
        collisionPadding={16}
        className="flex w-80 flex-col gap-3 rounded-2xl p-3"
        onEscapeKeyDown={() => {
          cancelled.current = true
        }}
      >
        <Input
          autoFocus
          value={title}
          maxLength={200}
          aria-label="Título da tarefa"
          placeholder="Nova tarefa"
          className="h-11 rounded-xl text-[15px]"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void commit()
            }
          }}
        />
        <div className="flex items-center gap-2">
          <span data-testid="quick-add-when" className="tabular inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px]">
            <CalendarClockIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
            {label}
          </span>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger aria-label="Lista" className="h-9 min-w-0 flex-1 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={() => {
              done.current = true
              onClose()
              props.onCreate(listId, state.day, state.time ?? undefined, title.trim() || undefined)
            }}
          >
            Mais detalhes
          </Button>
          <Button type="button" className="h-10 px-5" disabled={!title.trim()} onClick={() => void commit()}>
            Adicionar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ------------------------------------------------------------------ the view

/**
 * Calendário = the Agenda's own calendar parts (toolbar, MonthGrid, TimeGrid, DayStrip, MiniMonth) fed with this quadro's tasks (global
 * filters applied, plus the "Listas" and "Mostrar concluídas" choices of the toolbar). Phones: one calendar card with the day's list
 * below the month/week strip; desktop: grids and a rail with the mini month, the selected day and "Sem data".
 */
export function CalendarView(props: CalendarViewProps) {
  const { tasks, now, nowIso, timeZone, onOpenTask, onSchedule, onContextChange, lists, highlightId } = props
  const isMobile = useIsMobile()
  const labels = useLabelColors()
  const todayKey = dayKey(now, timeZone)
  const { prefs, update } = useCalendarPrefs()
  const [day, setDay] = useState(todayKey)
  const [scheduling, setScheduling] = useState<TaskView | null>(null)
  const [quick, setQuick] = useState<QuickAddState | null>(null)
  const view: CalendarViewId = resolveMode(prefs, isMobile)
  const setView = (next: CalendarViewId) => update((p) => ({ ...p, view: next }))
  // The app header's "+" pre-fills the selected day (today in the Agenda mode, which has no selected day).
  useEffect(() => onContextChange?.({ day: view === "agenda" ? todayKey : day, view }), [day, view, todayKey, onContextChange])

  const hidden = useMemo(() => new Set(prefs.hiddenLists), [prefs.hiddenLists])
  // Phones filter through the "Filtrar e ordenar" sheet (the board's own filters); the desktop toolbar has the "Listas" popover.
  const shown = useMemo(() => (isMobile ? tasks : tasks.filter((t) => t.id === highlightId || (!hidden.has(t.list_id) && (prefs.showDone || !t.completed_at)))), [isMobile, tasks, hidden, prefs.showDone, highlightId])
  const byId = useMemo(() => new Map(shown.map((t) => [t.id, t])), [shown])
  const items = useMemo(
    () =>
      shown
        .filter((t) => t.due_at)
        .map((t): AgendaItem => {
          const start = new Date(t.due_at!)
          return { key: `task:${t.id}`, kind: "task", id: t.id, title: t.title, start, end: new Date(start.getTime() + 30 * 60_000), allDay: !t.due_has_time, swatch: "neutro", color: resolveHex(taskColorOf(labels.state, t)), highlight: t.id === highlightId, editable: false }
        }),
    [shown, labels.state, highlightId]
  )
  const undated = useMemo(() => shown.filter((t) => !t.due_at && (isMobile || prefs.showDone || !t.completed_at)), [shown, prefs.showDone, isMobile])
  const itemsOn = useCallback((key: string) => items.filter((item) => dayKey(item.start, timeZone) === key).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime()), [items, timeZone])
  const tasksOn = useCallback((key: string) => itemsOn(key).map((i) => byId.get(i.id)).filter((t): t is TaskView => Boolean(t)), [itemsOn, byId])

  const isOpen = (id: string, fallback = true) => prefs.open[id] ?? fallback
  const toggle = (id: string, fallback = true) => update((p) => ({ ...p, open: { ...p.open, [id]: !(p.open[id] ?? fallback) } }))

  const schedulable = (task: TaskView): TaskActions => ({ ...props.actionsFor(task), schedule: () => setScheduling(task) })
  const confirmSchedule = (task: TaskView, key: string, time: string | null) => onSchedule(task, toDueIso(key, time, timeZone), Boolean(time))
  const dropOnDay = (id: string, key: string) => {
    const task = props.tasks.find((t) => t.id === id)
    if (!task) return
    // The time stays: a month cell only changes the day.
    const time = task.due_at && task.due_has_time ? splitDue(task.due_at, true, timeZone).time : null
    confirmSchedule(task, key, time)
  }
  const dropOnGrid = (id: string, key: string, time: string | null) => {
    const task = props.tasks.find((t) => t.id === id)
    if (task) confirmSchedule(task, key, time)
  }

  // ---- navigation
  const selected = parseISO(day)
  const weekStart = startOfWeek(selected)
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const title =
    view === "mes"
      ? upperFirst(format(selected, "MMMM 'de' yyyy", { locale: ptBR }))
      : view === "semana"
        ? `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM yyyy", { locale: ptBR })}`
        : view === "dia"
          ? upperFirst(format(selected, "EEEE, d 'de' MMMM", { locale: ptBR }))
          : `Próximos 30 dias`
  function shift(direction: -1 | 1) {
    const next = view === "mes" ? addMonths(selected, direction) : view === "semana" ? addWeeks(selected, direction) : view === "dia" ? addDays(selected, direction) : addDays(selected, 30 * direction)
    setDay(format(next, "yyyy-MM-dd"))
  }
  const swipe = useSwipe((direction) => shift(direction))

  // ---- creating
  const nextFreeHour = () => {
    const hour = Math.min(23, inTz(now, timeZone).getHours() + 1)
    return `${String(hour).padStart(2, "0")}:00`
  }
  const openAdd = (key: string) => props.onCreate(undefined, key, key === todayKey && (view === "semana" || view === "dia") ? nextFreeHour() : undefined)
  const quickAt = (key: string, time: string | null, anchor?: DOMRect) => setQuick({ anchor: anchor ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 1, 1), day: key, time })

  // A task that a filter (an unchecked list, "concluídas" off, or the board's filters) would hide still shows, with a way to see why.
  const announced = useRef<string | null>(null)
  useEffect(() => {
    if (!highlightId || announced.current === highlightId) return
    const task = tasks.find((t) => t.id === highlightId)
    if (!task) return
    announced.current = highlightId
    const hiddenByList = hidden.has(task.list_id) || (!prefs.showDone && Boolean(task.completed_at))
    if (!hiddenByList) return
    toast(`Tarefa criada em ${task.due_at ? lower(format(parseISO(dayKey(task.due_at, timeZone)), "EEEE, d 'de' MMMM", { locale: ptBR })) : "Sem data"}`, {
      action: { label: "Ver", onClick: () => update((p) => ({ ...p, hiddenLists: p.hiddenLists.filter((id) => id !== task.list_id), showDone: true })) },
    })
  }, [highlightId, tasks, hidden, prefs.showDone, timeZone, update])

  const filter = {
    label: "Listas",
    badge: hidden.size > 0 || !prefs.showDone ? `${lists.length - [...hidden].filter((id) => lists.some((l) => l.id === id)).length}/${lists.length}` : undefined,
    content: (
      <>
        {lists.map((list) => (
          <label key={list.id} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-accent">
            <Checkbox
              checked={!hidden.has(list.id)}
              aria-label={list.name}
              onCheckedChange={() => update((p) => ({ ...p, hiddenLists: p.hiddenLists.includes(list.id) ? p.hiddenLists.filter((id) => id !== list.id) : [...p.hiddenLists, list.id] }))}
            />
            {list.name}
          </label>
        ))}
        <div role="separator" className="my-1 h-px bg-border" />
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-[15px] hover:bg-accent">
          Mostrar concluídas
          <Switch checked={prefs.showDone} aria-label="Mostrar concluídas" onCheckedChange={(checked) => update((p) => ({ ...p, showDone: checked }))} />
        </label>
      </>
    ),
  }

  const toolbar = (
    <CalendarToolbar
      title={title}
      onToday={() => setDay(todayKey)}
      onShift={shift}
      view={view}
      onViewChange={setView}
      filter={filter}
      agendaTabOnDesktop
      trailing={isMobile ? null : <Button onClick={() => openAdd(day)}>Nova tarefa</Button>}
    />
  )

  const common: CardsProps = { props, actionsOf: schedulable, dueMode: "time" }
  const dayHeading = (
    <h3 data-testid="day-heading" className="text-[17px] leading-6 font-semibold">
      {upperFirst(format(selected, "EEEE, d 'de' MMMM", { locale: ptBR }))}
    </h3>
  )
  const dayList = <DayList {...common} day={day} tasks={tasksOn(day)} isOpen={isOpen} toggle={toggle} onAdd={() => openAdd(day)} />
  const undatedSection = <Undated {...common} tasks={undated} isOpen={isOpen} toggle={toggle} draggable={!isMobile} />

  const monthGrid = (
    <MonthGrid
      month={selected}
      todayKey={todayKey}
      selectedKey={day}
      itemsOn={itemsOn}
      onSelectDay={setDay}
      onOpenItem={(item) => onOpenTask(item.id)}
      onCreateOn={(key, anchor) => (isMobile ? setDay(key) : quickAt(key, null, anchor))}
      onDropItem={isMobile ? undefined : dropOnDay}
    />
  )

  // ---------------------------------------------------------------- phones
  if (isMobile) {
    // The mode switcher lives in the header card and "Listas" / "Mostrar concluídas" in its filter sheet; this card has one 40px toolbar.
    const mobileTitle =
      view === "mes"
        ? lower(format(selected, "MMMM 'de' yyyy", { locale: ptBR }))
        : view === "semana"
          ? `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM", { locale: ptBR })}`.replace(/\./g, "")
          : view === "dia"
            ? `${lower(format(selected, "EEEE", { locale: ptBR })).split("-")[0]}, ${format(selected, "d 'de' MMMM", { locale: ptBR })}`.toLowerCase()
            : "Próximos 30 dias"
    const dayTasks = tasksOn(day)
    // The day's tasks grouped by the quadro's lists, with their own collapse state (apart from Lista/Kanban): lists marked as concluded
    // and lists with nothing in them start collapsed.
    const collapsedHere = (list: ListRow) => {
      const saved = prefs.open[`list:${list.id}`]
      return saved === undefined ? list.is_done_list || !dayTasks.some((t) => t.list_id === list.id) : !saved
    }
    const groupProps: ViewProps = { ...props, tasks: dayTasks, actionsFor: schedulable, collapsed: collapsedHere, onToggleCollapse: (list) => update((p) => ({ ...p, open: { ...p.open, [`list:${list.id}`]: collapsedHere(list) } })) }
    return (
      <div data-testid="tasks-calendar" className="flex flex-col gap-4">
        <section aria-label="Calendário" data-testid="calendar-card" className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4" {...swipe}>
          <CalendarToolbar compact title={mobileTitle} onToday={() => setDay(todayKey)} onShift={shift} view={view} onViewChange={setView} filter={filter} />
          {view === "mes" ? monthGrid : null}
          {view === "semana" ? <DayStrip days={weekDays} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} /> : null}
          {view === "agenda" ? (
            <AgendaList {...common} from={day} byDay={tasksOn} todayKey={todayKey} isOpen={isOpen} toggle={toggle} />
          ) : (
            <div data-testid="day-lists" className="flex flex-col">
              {view !== "dia" ? dayHeading : null}
              {lists.map((list, i) => (
                <ListGroup
                  key={list.id}
                  list={list}
                  index={i}
                  total={lists.length}
                  tasks={dayTasks.filter((t) => t.list_id === list.id)}
                  props={groupProps}
                  mobile
                  dragEnabled={false}
                  dueMode="time"
                  onAddTask={(target) => props.onCreate(target.id, day)}
                />
              ))}
            </div>
          )}
          {undatedSection}
        </section>
        <ScheduleSheet task={scheduling} open={Boolean(scheduling)} onOpenChange={(open) => !open && setScheduling(null)} todayKey={todayKey} timeZone={timeZone} onConfirm={confirmSchedule} />
      </div>
    )
  }

  // --------------------------------------------------------------- desktop
  return (
    <div className="@container" data-testid="tasks-calendar">
      <div className="grid min-w-0 grid-cols-1 gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_320px] @min-[880px]:items-start">
        <div className={cn("flex min-w-0 flex-col gap-5", bentoCardClass())}>
          {toolbar}
          {view === "mes" ? monthGrid : null}
          {view === "semana" || view === "dia" ? (
            <TimeGrid
              days={view === "dia" ? [selected] : weekDays}
              todayKey={todayKey}
              itemsOn={itemsOn}
              nowIso={nowIso}
              onOpenItem={(item) => onOpenTask(item.id)}
              onSelectDay={view === "semana" ? (key) => (setDay(key), setView("dia")) : undefined}
              onCreate={(draft, anchor) => quickAt(draft.day, draft.start ?? null, anchor)}
              onCreateAllDay={(key, anchor) => quickAt(key, null, anchor)}
              onMoveEvent={(id, start) => {
                const task = byId.get(id)
                if (task) onSchedule(task, start.toISOString(), true)
              }}
              onDropTask={dropOnGrid}
              canDrag={(item) => !item.allDay}
              single={view === "dia"}
            />
          ) : null}
          {view === "agenda" ? <AgendaList {...common} from={day} byDay={tasksOn} todayKey={todayKey} isOpen={isOpen} toggle={toggle} /> : null}
        </div>
        <aside className="flex min-w-0 flex-col gap-4" aria-label="Painel do calendário">
          <BentoCard title="Calendário">
            <MiniMonth month={selected} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} onShift={(n) => setDay(format(addMonths(selected, n), "yyyy-MM-dd"))} />
          </BentoCard>
          <BentoCard title={upperFirst(format(selected, "EEEE, d 'de' MMMM", { locale: ptBR }))}>{dayList}</BentoCard>
          <BentoCard>{undatedSection}</BentoCard>
        </aside>
      </div>
      <QuickAdd state={quick} props={props} onClose={() => setQuick(null)} />
      <ScheduleSheet task={scheduling} open={Boolean(scheduling)} onOpenChange={(open) => !open && setScheduling(null)} todayKey={todayKey} timeZone={timeZone} onConfirm={confirmSchedule} />
    </div>
  )
}
