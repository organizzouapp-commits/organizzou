"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addDays, addMonths, addWeeks, eachDayOfInterval, format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarClockIcon, ChevronDownIcon } from "lucide-react"

import { BentoCard, bentoCardClass } from "@/components/organizzou/Bento"
import { AGENDA_DAYS, agendaTitle, CalendarToolbar, DayStrip, MiniMonth, MonthGrid, TimeGrid, type CalendarViewId } from "@/components/calendar/agenda-screen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AgendaItem } from "@/features/calendar/types"
import { resolveHex, taskColorOf } from "@/features/tasks/colors"
import type { TaskView } from "@/features/tasks/types"
import { dayKey, splitDue, toDueIso } from "@/lib/dates"
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
/** "Sem data" is shown as the last group of the day, through the same group component as the lists (a pseudo list). */
const UNDATED_ID = "__undated__"
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const lower = (text: string) => text.toLowerCase()

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


/** Agenda view: the next 30 days, one collapsible header per day with tasks ("qua, 4 nov · 3"): today open, the rest closed. */
function AgendaList({ from, byDay, todayKey, props, actionsOf, isOpen, toggle }: CardsProps & { from: string; byDay: (key: string) => TaskView[]; todayKey: string; isOpen: (id: string, fallback?: boolean) => boolean; toggle: (id: string, fallback?: boolean) => void }) {
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => format(addDays(parseISO(from), i), "yyyy-MM-dd")).filter((key) => byDay(key).length > 0)
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

  // The board's own filters ("Filtros": Listas and "Mostrar concluídas") already shaped `tasks`; nothing else hides tasks here.
  const shown = tasks
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
  const undated = useMemo(() => shown.filter((t) => !t.due_at), [shown])
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
          : agendaTitle(day, todayKey)
  function shift(direction: -1 | 1) {
    const next = view === "mes" ? addMonths(selected, direction) : view === "semana" ? addWeeks(selected, direction) : view === "dia" ? addDays(selected, direction) : addDays(selected, AGENDA_DAYS * direction)
    setDay(format(next, "yyyy-MM-dd"))
  }
  const swipe = useSwipe((direction) => shift(direction))
  // `T` goes to today (ignored while typing or with a dialog open).
  useEffect(() => {
    if (isMobile) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "t" || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("[role=dialog], [role=alertdialog]")) return
      event.preventDefault()
      setDay(todayKey)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isMobile, todayKey])

  // ---- creating
  const quickAt = (key: string, time: string | null, anchor?: DOMRect) => setQuick({ anchor: anchor ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 1, 1), day: key, time })

  const toolbar = <CalendarToolbar title={title} onToday={() => setDay(todayKey)} onShift={shift} view={view} onViewChange={setView} />

  const common: CardsProps = { props, actionsOf: schedulable, dueMode: "time" }
  const dayHeading = (
    <h3 data-testid="day-heading" className="text-[15px] leading-6 font-semibold">
      {upperFirst(format(selected, "EEEE, d 'de' MMMM", { locale: ptBR }))}
    </h3>
  )
  // The selected day's tasks grouped by the quadro's lists (the same group component as Lista), with their own collapse state: lists marked
  // as concluded and lists with nothing in them start collapsed. Used under the calendar card on phones and in the desktop rail.
  const dayTasks = tasksOn(day)
  const collapsedHere = (list: ListRow) => {
    const saved = prefs.open[`list:${list.id}`]
    if (list.id === UNDATED_ID) return saved === undefined ? true : !saved
    return saved === undefined ? list.is_done_list || !dayTasks.some((t) => t.list_id === list.id) : !saved
  }
  const groupProps: ViewProps = { ...props, tasks: dayTasks, actionsFor: schedulable, collapsed: collapsedHere, onToggleCollapse: (list) => update((p) => ({ ...p, open: { ...p.open, [`list:${list.id}`]: collapsedHere(list) } })) }
  const undatedList = { id: UNDATED_ID, name: "Sem data", is_done_list: false, board_id: "", position: 0, user_id: "", created_at: "", updated_at: "" } as ListRow
  const undatedGroup = (
    <div data-testid="undated-tray">
      <ListGroup
        pseudo
        nativeDrag={!isMobile}
        list={undatedList}
        index={lists.length}
        total={lists.length + 1}
        tasks={undated}
        props={{ ...groupProps, tasks: undated }}
        mobile
        dragEnabled={false}
        dueMode="time"
        highlightId={highlightId}
        onAddTask={() => {
          // An undated task in the first open list.
          const target = lists.find((l) => !l.is_done_list) ?? lists[0]
          if (target) props.onCreate(target.id)
        }}
      />
    </div>
  )
  const dayGroups = (
    <div data-testid="day-lists" className="flex flex-col">
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
          highlightId={highlightId}
          onAddTask={(target) => props.onCreate(target.id, day)}
        />
      ))}
      {undatedGroup}
    </div>
  )

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
            : agendaTitle(day, todayKey)
    return (
      <div data-testid="tasks-calendar" className="flex flex-col gap-4">
        {/* The solid card holds only the toolbar and the month grid / week strip; the lists below sit flat on the page background. */}
        <section aria-label="Agenda" data-testid="calendar-card" className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4" {...swipe}>
          <CalendarToolbar compact title={mobileTitle} onToday={() => setDay(todayKey)} onShift={shift} view={view} onViewChange={setView} />
          {view === "mes" ? monthGrid : null}
          {view === "semana" ? <DayStrip days={weekDays} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} /> : null}
        </section>
        <div data-testid="agenda-below" className="flex flex-col gap-1 px-1">
          {view === "agenda" ? (
            <>
              <AgendaList {...common} from={day} byDay={tasksOn} todayKey={todayKey} isOpen={isOpen} toggle={toggle} />
              {undatedGroup}
            </>
          ) : (
            <>
              {view !== "dia" ? dayHeading : null}
              {dayGroups}
            </>
          )}
        </div>
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
          <BentoCard title={upperFirst(format(selected, "EEEE, d 'de' MMMM", { locale: ptBR }))}>{dayGroups}</BentoCard>
        </aside>
      </div>
      <QuickAdd state={quick} props={props} onClose={() => setQuick(null)} />
      <ScheduleSheet task={scheduling} open={Boolean(scheduling)} onOpenChange={(open) => !open && setScheduling(null)} todayKey={todayKey} timeZone={timeZone} onConfirm={confirmSchedule} />
    </div>
  )
}
