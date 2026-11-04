"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DumbbellIcon,
  GraduationCapIcon,
  MapPinIcon,
  PencilIcon,
  RepeatIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SquareCheckIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { TaskCardBody, type TaskActions } from "@/components/tasks/task-card"
import type { TaskView } from "@/features/tasks/types"
import { completeTask, deleteTask } from "@/features/tasks/actions"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { BentoCard } from "@/components/organizzou/Bento"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { ColorPicker } from "@/components/organizzou/ColorPicker"
import { LabelColorsProvider, useLabelColors, useLabelColorsStore } from "@/components/tasks/label-colors-context"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { expandEvent, layoutDay, REPEAT_OPTIONS, repeatLabel } from "@/features/calendar/recurrence"
import type { AgendaItem, AgendaKind, EventRow } from "@/features/calendar/types"
import { dayKey, inTz, toDueIso } from "@/lib/dates"
import type { SwatchId } from "@/lib/swatches"
import { resolveHex, type ColorValue } from "@/features/tasks/colors"
import { cn } from "@/lib/utils"
import type { DeadlineRow } from "@/features/studies/types"
import type { WorkoutPlanRow } from "@/features/workouts/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, SP_TIMEZONE, newId } from "@/lib/sp-time"

export type CalendarViewId = "mes" | "semana" | "dia" | "agenda"
type View = CalendarViewId

const TZ = SP_TIMEZONE
const HOUR_START = 6
const HOUR_END = 23
const ROW_HEIGHT = 56
const SNAP = 15 // minutes

export const MODE_ITEMS = [
  { id: "mes", label: "Mês" },
  { id: "semana", label: "Semana" },
  { id: "dia", label: "Dia" },
  { id: "agenda", label: "Agenda" },
]

const KIND_META: Record<AgendaKind, { label: string; icon: LucideIcon | null }> = {
  event: { label: "Eventos", icon: null },
  task: { label: "Tarefas", icon: SquareCheckIcon },
  workout: { label: "Treinos", icon: DumbbellIcon },
  study: { label: "Estudos", icon: GraduationCapIcon },
}

const REMINDER_OPTIONS = [
  { value: "none", label: "Sem lembrete", minutes: null },
  { value: "10", label: "10 minutos antes", minutes: 10 },
  { value: "30", label: "30 minutos antes", minutes: 30 },
  { value: "60", label: "1 hora antes", minutes: 60 },
  { value: "1440", label: "1 dia antes", minutes: 1440 },
] as const

function upperFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function minutesOfDay(date: Date) {
  const local = inTz(date, TZ)
  return local.getHours() * 60 + local.getMinutes()
}

export function formatTime(date: Date) {
  const local = inTz(date, TZ)
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
}

function hhmm(minutes: number) {
  const m = Math.max(0, Math.min(24 * 60 - 1, minutes))
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function describeItemTime(item: AgendaItem) {
  return item.allDay ? "Dia inteiro" : `${formatTime(item.start)} – ${formatTime(item.end)}`
}

function ItemIcon({ kind, className }: { kind: AgendaKind; className?: string }) {
  const Icon = KIND_META[kind].icon
  return Icon ? <Icon aria-hidden strokeWidth={1.75} className={className ?? "size-3 shrink-0"} /> : null
}

/** The item's color: its own (a task color) or the legacy swatch an event was saved with ("neutro" = none). Never wiped. */
export function itemColor(item: AgendaItem): string | null {
  return item.color ?? (item.swatch && item.swatch !== "neutro" ? resolveHex(item.swatch) : null)
}

/** The text is ALWAYS the neutral foreground token; the color only tints the chip and draws the left bar. */
function itemTone() {
  return "text-foreground"
}

/** Colored: the color at 16% over the surface and a 3px solid bar on the left. No color: a 7% neutral tint and no bar. */
function itemStyle(item: AgendaItem): React.CSSProperties {
  const color = itemColor(item)
  if (!color) return { backgroundColor: "color-mix(in oklab, var(--foreground) 7%, transparent)" }
  return { backgroundColor: `color-mix(in oklab, ${color} 16%, var(--card))`, boxShadow: `inset 3px 0 0 ${color}` }
}

const HIGHLIGHT = "ring-2 ring-primary ring-offset-1 ring-offset-card"

/**
 * The calendar toolbar, shared by the Agenda page and Tarefas > Agenda. Desktop: ‹ › circles and the period title (click = today) on
 * the left, `trailing` (the Filtros pill) and the shared PillTabs Mês | Semana | Dia | Agenda on the right. `compact` (phones): one 40px
 * row, title + ‹ ›; the modes live in the header block above.
 */
export function CalendarToolbar({
  title,
  onToday,
  onShift,
  view,
  onViewChange,
  trailing,
  compact = false,
}: {
  /** Phones in Tarefas: ONE 40px row — the title at the left ("Ir para hoje" on tap), ‹ › at the right. No Hoje, no filter, no mode tabs (the header card has them). */
  compact?: boolean
  title: string
  onToday: () => void
  onShift: (direction: -1 | 1) => void
  view: CalendarViewId
  onViewChange: (view: CalendarViewId) => void
  trailing?: React.ReactNode
}) {
  const titleButton = (className: string) => (
    <button type="button" data-testid="calendar-title" aria-label="Ir para hoje" title="Ir para hoje" onClick={onToday} className={cn("min-w-0 cursor-pointer truncate rounded-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
      {title}
    </button>
  )
  if (compact) {
    return (
      <div className="flex h-10 items-center gap-2" data-testid="calendar-toolbar">
        {titleButton("flex-1 text-[15px] leading-6 font-semibold")}
        <Button variant="ghost" size="icon" aria-label="Anterior" className="shrink-0" onClick={() => onShift(-1)}>
          <ChevronLeftIcon strokeWidth={1.75} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Próximo" className="shrink-0" onClick={() => onShift(1)}>
          <ChevronRightIcon strokeWidth={1.75} />
        </Button>
      </div>
    )
  }
  return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="calendar-toolbar">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Anterior" onClick={() => onShift(-1)}>
            <ChevronLeftIcon strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Próximo" onClick={() => onShift(1)}>
            <ChevronRightIcon strokeWidth={1.75} />
          </Button>
        </div>
        {titleButton("flex-1 basis-40 text-xl leading-7 font-semibold tracking-[-0.01em]")}
        {trailing}
        <PillTabs ariaLabel="Visão" items={MODE_ITEMS} value={view} onSelect={(item) => onViewChange(item.id as CalendarViewId)} />
      </div>
  )
}

/** What the "new event" dialog starts with: a day, and optionally the time range picked on the grid. */
export type Draft = { day: string; start?: string; end?: string }

/** What the other modules put on the calendar (real accounts). Events are the Agenda's own rows. */
export type AgendaTask = { id: string; title: string; due_at: string; due_has_time: boolean; board_id: string; board_name: string; completed_at?: string | null }
export type AgendaInitial = { events: EventRow[]; tasks: AgendaTask[]; plans: WorkoutPlanRow[]; deadlines: DeadlineRow[] }

/** The Agenda mode lists this many days; ‹ › step by the same amount. One constant for the Agenda page and Tarefas > Agenda. */
export const AGENDA_DAYS = 30

/** "Próximos 30 dias" on the current window, otherwise the range ("5 dez – 3 jan"). */
export function agendaTitle(from: string, todayKey: string) {
  if (from === todayKey) return `Próximos ${AGENDA_DAYS} dias`
  const clean = (d: Date) => format(d, "d MMM", { locale: ptBR }).replace(/\./g, "")
  return `${clean(parseISO(from))} – ${clean(addDays(parseISO(from), AGENDA_DAYS - 1))}`
}

/** What the page can do to a task: the real server actions by default (the fixture swaps them for in-memory ones). */
export type AgendaTaskApi = {
  complete: (id: string, done: boolean) => Promise<{ ok: boolean; error?: string }>
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>
}
const realTaskApi: AgendaTaskApi = {
  complete: (id, done) => completeTask({ id, done }),
  remove: (id) => deleteTask(id),
}

/** Per-occurrence state of events, treinos and estudos (done, skipped dates). localStorage until `agenda_occurrence_state` is applied. */
type LocalState = { done: Record<string, true>; skipped: Record<string, true> }
const LOCAL_KEY = "organizzou:agenda-local"
const occurrenceKey = (item: Pick<AgendaItem, "kind" | "id" | "start">) => `${item.kind}:${item.id}:${dayKey(item.start, TZ)}`

export function AgendaScreen({ nowIso, initial, taskApi = realTaskApi, memory = false }: { nowIso: string; initial: AgendaInitial; taskApi?: AgendaTaskApi; /** Keep events, treinos and estudos in memory (the dev fixture has no session to save with). */ memory?: boolean }) {
  const todayKey = dayOf(nowIso)
  const isMobile = useIsMobile()
  const [view, setView] = useState<View>("semana")
  const [day, setDayState] = useState(todayKey)
  useEffect(() => {
    // The selected day lives in the URL (?date=YYYY-MM-DD) so a reload or a shared link keeps it. Read after mount, so the server and
    // the first client render agree.
    const wanted = new URLSearchParams(window.location.search).get("date")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted)) setDayState(wanted)
  }, [])
  const setDay = (next: string) => {
    setDayState(next)
    const url = new URL(window.location.href)
    if (next === todayKey) url.searchParams.delete("date")
    else url.searchParams.set("date", next)
    window.history.replaceState(null, "", url)
  }
  const savedEvents = usePersistedRows<EventRow>("events", initial.events)
  const memEvents = useState<EventRow[]>(initial.events)
  const [events, setEvents] = memory ? memEvents : savedEvents
  const savedPlans = usePersistedRows<WorkoutPlanRow>("workout_plans", initial.plans)
  const memPlans = useState<WorkoutPlanRow[]>(initial.plans)
  const [plans, setPlans] = memory ? memPlans : savedPlans
  const savedDeadlines = usePersistedRows<DeadlineRow>("study_deadlines", initial.deadlines)
  const memDeadlines = useState<DeadlineRow[]>(initial.deadlines)
  const [deadlines, setDeadlines] = memory ? memDeadlines : savedDeadlines
  const [local, setLocal] = useState<LocalState>({ done: {}, skipped: {} })
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as Partial<LocalState>
      // localStorage only exists in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocal({ done: raw.done ?? {}, skipped: raw.skipped ?? {} })
    } catch {
      setLocal({ done: {}, skipped: {} })
    }
  }, [])
  const changeLocal = (change: (current: LocalState) => LocalState) =>
    setLocal((current) => {
      const next = change(current)
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      } catch {
        // Private mode: the choice just does not survive the visit.
      }
      return next
    })
  const [ask, setAsk] = useState<AgendaItem | null>(null)
  const [tasks, setTasks] = useState(initial.tasks)
  const router = useRouter()
  const labels = useLabelColorsStore()
  const [kinds, setKinds] = useState<Set<AgendaKind>>(new Set(["event", "task", "workout", "study"]))
  const [showDone, setShowDone] = useState(false)
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterSheet, setFilterSheet] = useState(false)
  const [creating, setCreating] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [toDelete, setToDelete] = useState<EventRow | null>(null)

  // One range covers every view: the month grid that contains the selected day (week and day views always fall inside it).
  const gridFrom = startOfWeek(startOfMonth(parseISO(day)))
  const gridTo = addDays(new Date(Math.max(endOfWeek(endOfMonth(parseISO(day))).getTime(), addDays(parseISO(day), AGENDA_DAYS).getTime())), 1)

  // ------------------------------------------------ gather items from every module
  function collect(from: Date, to: Date): AgendaItem[] {
    const items: AgendaItem[] = []
    if (kinds.has("event")) {
      for (const event of events) {
        const own = resolveHex(labels.colorOf("event", event.id))
        for (const item of expandEvent(event, from, to, TZ)) {
          if (local.skipped[occurrenceKey(item)]) continue
          const marked = { ...item, done: Boolean(local.done[occurrenceKey(item)]) }
          items.push(own ? { ...marked, color: own } : marked)
        }
      }
    }
    if (kinds.has("task")) {
      for (const task of tasks) {
        if (task.completed_at && !showDone) continue
        const start = new Date(task.due_at)
        if (start < from || start >= to) continue
        items.push({ key: `task:${task.id}`, kind: "task", id: task.id, title: task.title, start, end: new Date(start.getTime() + 30 * 60_000), allDay: !task.due_has_time, swatch: "neutro", detail: task.board_name, done: Boolean(task.completed_at), editable: false })
      }
    }
    // Workout days come from the plans' weekdays and study dates from the exams and deliveries: all-day, because no hour was chosen.
    for (let cursor = from; cursor < to; cursor = addDays(cursor, 1)) {
      const key = dayKey(cursor, TZ)
      const weekday = parseISO(key).getDay()
      const start = new Date(`${key}T12:00:00-03:00`)
      const end = new Date(start.getTime() + 60 * 60_000)
      if (kinds.has("workout")) {
        for (const plan of plans.filter((p) => p.weekdays.includes(weekday) && !local.skipped[`workout:${p.id}:${key}`])) items.push({ key: `workout:${plan.id}:${key}`, kind: "workout", id: plan.id, title: plan.name, start, end, allDay: true, swatch: "neutro", detail: "Treino", category: "Treino", editable: false })
      }
      if (kinds.has("study")) {
        for (const due of deadlines.filter((d) => d.due_on === key && !local.skipped[`study:${d.id}:${key}`])) items.push({ key: `study:${due.id}`, kind: "study", id: due.id, title: due.title, start, end, allDay: true, swatch: "neutro", detail: due.kind === "exam" ? "Prova" : "Entrega", category: due.kind === "exam" ? "Prova" : "Entrega", editable: false })
      }
    }
    // Treinos and estudos have no completion of their own: it is recorded per occurrence (date).
    for (const item of items) if ((item.kind === "workout" || item.kind === "study") && local.done[occurrenceKey(item)]) item.done = true
    const text = query.trim().toLowerCase()
    const visible = showDone ? items : items.filter((item) => !item.done)
    return text ? visible.filter((item) => item.title.toLowerCase().includes(text)) : visible
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => collect(gridFrom, gridTo), [events, tasks, plans, deadlines, local, kinds, day, nowIso, showDone, query, labels.state])
  const sortItems = (list: AgendaItem[]) => [...list].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
  const itemsOn = (key: string) => sortItems(items.filter((item) => dayKey(item.start, TZ) === key))

  // --------------------------------------------------------------- navigation
  function shift(direction: -1 | 1) {
    const date = parseISO(day)
    const next = view === "mes" ? addMonths(date, direction) : view === "semana" ? addWeeks(date, direction) : addDays(date, view === "agenda" ? AGENDA_DAYS * direction : direction)
    setDay(format(next, "yyyy-MM-dd"))
  }

  const weekStart = startOfWeek(parseISO(day))
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const title =
    view === "mes"
      ? upperFirst(format(parseISO(day), "MMMM 'de' yyyy", { locale: ptBR }))
      : view === "semana"
        ? `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM yyyy", { locale: ptBR })}`
        : view === "agenda"
          ? agendaTitle(day, todayKey)
          : upperFirst(format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }))

  function toggleKind(kind: AgendaKind) {
    setKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const selectedEvent = selected?.kind === "event" ? events.find((e) => e.id === selected.id) : undefined

  function confirmDelete() {
    const event = toDelete
    setToDelete(null)
    if (!event) return
    setEvents((current) => current.filter((e) => e.id !== event.id))
    setSelected(null)
    toast("Evento excluído.")
  }

  /** Drag to move or resize: only plain (non-repeating) events; repeating ones go through the edit dialog. */
  function moveEvent(id: string, start: Date, end: Date) {
    setEvents((current) =>
      current.map((e) => (e.id === id && !e.rrule ? { ...e, starts_at: start.toISOString(), ends_at: end.toISOString(), updated_at: new Date().toISOString() } : e))
    )
    toast("Evento atualizado.")
  }
  const canDrag = (item: AgendaItem) => item.kind === "event" && item.editable && !events.find((e) => e.id === item.id)?.rrule

  usePrimaryAction("Novo evento", () => setCreating({ day }))

  const effectiveView: View = view
  const taskBoard = new Map(tasks.map((t) => [t.id, t.board_id]))
  /** Completes (or reopens) a task in place, with the undo toast. */
  async function setTaskDone(id: string, done: boolean) {
    const task = tasks.find((t) => t.id === id)
    const previous = task?.completed_at ?? null
    setTasks((current) => current.map((t) => (t.id === id ? { ...t, completed_at: done ? new Date().toISOString() : null } : t)))
    const result = await taskApi.complete(id, done)
    if (!result.ok) {
      setTasks((current) => current.map((t) => (t.id === id ? { ...t, completed_at: previous } : t)))
      toast.error(result.error ?? "Não consegui salvar.")
      return
    }
    // "Desfazer" goes back to the opposite state explicitly (the screen may have re-rendered since).
    toast(done ? "Tarefa concluída." : "Tarefa reaberta.", { duration: 8000, action: { label: "Desfazer", onClick: () => void setTaskDone(id, !done) } })
  }
  const toggleTask = (item: AgendaItem) => void setTaskDone(item.id, !tasks.find((t) => t.id === item.id)?.completed_at)

  /** Deleting waits for the undo window (8 s): "Desfazer" puts the row back and nothing was deleted. */
  const pendingDelete = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  function deleteTaskItem(item: AgendaItem) {
    const task = tasks.find((t) => t.id === item.id)
    if (!task) return
    setTasks((current) => current.filter((t) => t.id !== task.id))
    const timer = setTimeout(async () => {
      pendingDelete.current.delete(task.id)
      const result = await taskApi.remove(task.id)
      if (!result.ok) {
        setTasks((current) => [...current, task])
        toast.error(result.error ?? "Não consegui excluir.")
      }
    }, 8000)
    pendingDelete.current.set(task.id, timer)
    toast("Tarefa excluída.", {
      duration: 8000,
      action: {
        label: "Desfazer",
        onClick: () => {
          clearTimeout(pendingDelete.current.get(task.id))
          pendingDelete.current.delete(task.id)
          setTasks((current) => (current.some((t) => t.id === task.id) ? current : [...current, task]))
        },
      },
    })
  }

  /** Completes an event, treino or estudo occurrence (stored per date), with the undo toast. */
  function toggleOccurrence(item: AgendaItem) {
    const key = occurrenceKey(item)
    const done = !local.done[key]
    changeLocal((current) => {
      const next = { ...current.done }
      if (done) next[key] = true
      else delete next[key]
      return { ...current, done: next }
    })
    toast(done ? "Concluído." : "Reaberto.", {
      duration: 8000,
      action: {
        label: "Desfazer",
        onClick: () =>
          changeLocal((current) => {
            const next = { ...current.done }
            if (done) delete next[key]
            else next[key] = true
            return { ...current, done: next }
          }),
      },
    })
  }
  const toggleItem = (item: AgendaItem) => (item.kind === "task" ? toggleTask(item) : toggleOccurrence(item))

  /** Removes one row (event, treino or estudo), with the undo toast that puts it back. */
  function deleteRow(item: AgendaItem, scope: "series" | "occurrence") {
    if (scope === "occurrence") {
      const key = occurrenceKey(item)
      changeLocal((current) => ({ ...current, skipped: { ...current.skipped, [key]: true } }))
      toast("Ocorrência excluída.", {
        duration: 8000,
        action: {
          label: "Desfazer",
          onClick: () =>
            changeLocal((current) => {
              const next = { ...current.skipped }
              delete next[key]
              return { ...current, skipped: next }
            }),
        },
      })
      return
    }
    if (item.kind === "event") {
      const row = events.find((e) => e.id === item.id)
      if (!row) return
      setEvents((current) => current.filter((e) => e.id !== row.id))
      toast("Evento excluído.", { duration: 8000, action: { label: "Desfazer", onClick: () => setEvents((current) => (current.some((e) => e.id === row.id) ? current : [...current, row])) } })
    } else if (item.kind === "workout") {
      const row = plans.find((p) => p.id === item.id)
      if (!row) return
      setPlans((current) => current.filter((p) => p.id !== row.id))
      toast("Treino excluído.", { duration: 8000, action: { label: "Desfazer", onClick: () => setPlans((current) => (current.some((p) => p.id === row.id) ? current : [...current, row])) } })
    } else if (item.kind === "study") {
      const row = deadlines.find((d) => d.id === item.id)
      if (!row) return
      setDeadlines((current) => current.filter((d) => d.id !== row.id))
      toast("Estudo excluído.", { duration: 8000, action: { label: "Desfazer", onClick: () => setDeadlines((current) => (current.some((d) => d.id === row.id) ? current : [...current, row])) } })
    }
  }

  /** Excluir: tasks wait for the undo window; a series (treino, repeating event) first asks "Só esta ocorrência" / "Toda a série". */
  function requestDelete(item: AgendaItem) {
    if (item.kind === "task") return deleteTaskItem(item)
    const repeats = item.kind === "workout" || (item.kind === "event" && Boolean(events.find((e) => e.id === item.id)?.rrule))
    if (repeats) return setAsk(item)
    deleteRow(item, "series")
  }

  const noop = () => {}
  const rowOf = (item: AgendaItem) => {
    const task = {
      id: item.kind === "task" ? item.id : item.key,
      board_id: "",
      list_id: "",
      title: item.title,
      description: null,
      priority: "none",
      due_at: item.start.toISOString(),
      due_has_time: !item.allDay,
      completed_at: item.done ? new Date(0).toISOString() : null,
      archived: false,
      position: 0,
      swatch: "neutro",
      category: item.category ?? null,
      user_id: "",
      created_at: "",
      updated_at: "",
      tagIds: [],
      checklistTotal: 0,
      checklistDone: 0,
      commentCount: 0,
      attachmentCount: 0,
    } as unknown as TaskView
    const actions: TaskActions = { open: () => openItem(item), toggle: () => toggleItem(item), remove: () => requestDelete(item), postpone1h: noop, tomorrow: noop, move: noop, select: noop, duplicate: noop, rename: async () => false }
    const timeText = item.allDay ? "Dia todo" : item.kind === "task" ? formatTime(item.start) : `${formatTime(item.start)} – ${formatTime(item.end)}`
    return (
      <div key={item.key} data-agenda-card data-kind={item.kind} data-day-item={item.id}>
        <TaskCardBody anchor task={task} tags={[]} now={new Date(nowIso)} timeZone={TZ} actions={actions} agenda={{ kind: item.kind, timeText, place: item.location }} colorOverride={itemColor(item)} />
      </div>
    )
  }

  /** A task opens the SAME dialog (and URL) as in Tarefas; events, treinos and estudos open the event dialog. */
  function openItem(item: AgendaItem) {
    if (item.kind === "task") {
      const board = taskBoard.get(item.id)
      if (board) router.push(`/dashboard/tarefas/${board}?tarefa=${item.id}`)
      return
    }
    // Treinos and estudos are read-only here: they open in their own module.
    if (item.kind === "workout") return void router.push("/dashboard/treinos")
    if (item.kind === "study") return void router.push("/dashboard/estudos")
    setSelected(item)
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, todayKey])

  const hidden = (4 - kinds.size) + (showDone ? 1 : 0)
  // Calendários (checkbox rows with a color dot) and "Mostrar concluídas": ONE panel, a popover on desktop and a sheet on phones.
  const filterContent = (
    <div className="flex flex-col gap-1" data-testid="agenda-filters">
      <p className="px-3 pt-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Calendários</p>
      {(Object.keys(KIND_META) as AgendaKind[]).map((kind) => (
        <label key={kind} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-accent">
          <Checkbox checked={kinds.has(kind)} onCheckedChange={() => toggleKind(kind)} />
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-foreground/55" />
          {KIND_META[kind].label}
        </label>
      ))}
      <label className="mt-1 flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-[15px] hover:bg-accent">
        Mostrar concluídas
        <Switch checked={showDone} onCheckedChange={setShowDone} aria-label="Mostrar concluídas" />
      </label>
    </div>
  )
  const filterBadge = hidden > 0 ? <span className="tabular flex size-5 items-center justify-center rounded-full bg-highlight text-[11px] font-semibold text-highlight-foreground">{hidden}</span> : null

  const filtros = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 px-4" data-testid="calendar-filter">
          <SlidersHorizontalIcon strokeWidth={1.75} /> Filtros
          {filterBadge}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-1 p-2">
        {filterContent}
      </PopoverContent>
    </Popover>
  )

  const itemsView = (
    <>
      {effectiveView === "mes" ? (
        <MonthGrid month={parseISO(day)} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} onOpenItem={openItem} onCreateOn={(key) => (isMobile ? setDay(key) : setCreating({ day: key }))} />
      ) : null}
      {effectiveView === "semana" ? (
        isMobile ? (
          <DayStrip days={weekDays} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} />
        ) : (
          <TimeGrid
            days={weekDays}
            todayKey={todayKey}
            itemsOn={itemsOn}
            nowIso={nowIso}
            onOpenItem={openItem}
            onSelectDay={(key) => {
              setDay(key)
              setView("dia")
            }}
            onCreate={setCreating}
            onMoveEvent={moveEvent}
            canDrag={canDrag}
          />
        )
      ) : null}
      {effectiveView === "dia" && !isMobile ? <TimeGrid days={[parseISO(day)]} todayKey={todayKey} itemsOn={itemsOn} nowIso={nowIso} onOpenItem={openItem} onCreate={setCreating} onMoveEvent={moveEvent} canDrag={canDrag} single /> : null}
      {effectiveView === "agenda" && !isMobile ? <AgendaDays from={day} todayKey={todayKey} itemsOn={itemsOn} renderRow={rowOf} flat={isMobile} /> : null}
    </>
  )

  const dayTitle = day === todayKey ? `Hoje · ${format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR })}` : upperFirst(format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }))
  const mobileTitle =
    view === "mes"
      ? format(parseISO(day), "MMMM 'de' yyyy", { locale: ptBR }).toLowerCase()
      : view === "semana"
        ? `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM", { locale: ptBR })}`.replace(/\./g, "")
        : view === "dia"
          ? format(parseISO(day), "EEE, d 'de' MMMM", { locale: ptBR }).toLowerCase()
          : agendaTitle(day, todayKey)

  const main = isMobile ? (
    <div className="flex flex-col gap-4" data-testid="agenda-mobile">
      <section aria-label="Agenda" data-testid="agenda-header-block" className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-3">
        <div className="flex h-11 items-center gap-2">
          {searchOpen ? (
            <>
              <Input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar na agenda" placeholder="Buscar na agenda" className="h-11 min-w-0 flex-1 rounded-full" />
              <Button variant="ghost" className="h-11" onClick={() => (setQuery(""), setSearchOpen(false))}>
                Fechar
              </Button>
            </>
          ) : (
            <>
              <h2 className="min-w-0 flex-1 truncate text-[18px] leading-7 font-semibold">Agenda</h2>
              <Button variant="outline" size="icon" aria-label="Buscar na agenda" className="relative size-9 after:absolute after:-inset-1" onClick={() => setSearchOpen(true)}>
                <SearchIcon strokeWidth={1.75} />
              </Button>
              <Button variant="outline" size="icon" aria-label={hidden > 0 ? `Filtros, ${hidden} ativos` : "Filtros"} data-testid="calendar-filter" className="relative size-9 after:absolute after:-inset-1" onClick={() => setFilterSheet(true)}>
                <SlidersHorizontalIcon strokeWidth={1.75} />
                {hidden > 0 ? <span className="tabular absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-highlight text-[10px] font-semibold text-highlight-foreground">{hidden}</span> : null}
              </Button>
            </>
          )}
        </div>
        <PillTabs equal ariaLabel="Visão" items={MODE_ITEMS} value={view} onSelect={(item) => setView(item.id as View)} />
      </section>
      <section aria-label="Calendário" data-testid="calendar-card" className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4">
        <CalendarToolbar compact title={mobileTitle} onToday={() => setDay(todayKey)} onShift={shift} view={view} onViewChange={setView} />
        {view === "mes" || view === "semana" ? itemsView : null}
      </section>
      <div className="flex flex-col gap-1 px-1" data-testid="agenda-below">
        {view === "agenda" ? (
          <AgendaDays from={day} todayKey={todayKey} itemsOn={itemsOn} renderRow={rowOf} flat={isMobile} />
        ) : (
          <>
            <h3 data-testid="day-heading" className="text-[15px] leading-6 font-semibold">
              {dayTitle}
            </h3>
            <DayGroups items={itemsOn(day)} day={day} renderRow={rowOf} onNewEvent={() => setCreating({ day })} flat />
          </>
        )}
      </div>
      <Drawer open={filterSheet} onOpenChange={setFilterSheet}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription className="sr-only">Escolha o que aparece na agenda.</DrawerDescription>
          </DrawerHeader>
          <div className="scroll-soft overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{filterContent}</div>
        </DrawerContent>
      </Drawer>
    </div>
  ) : (
    <BentoCard>
      <div className="flex flex-col gap-5">
        <CalendarToolbar
         
          trailing={filtros}
          title={title}
          onToday={() => setDay(todayKey)}
          onShift={shift}
          view={view}
          onViewChange={setView}
         
        />
        {itemsView}
      </div>
    </BentoCard>
  )

  const aside = (
    <>
      <BentoCard title="Calendário">
        <MiniMonth month={parseISO(day)} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} onShift={(n) => setDay(format(addMonths(parseISO(day), n), "yyyy-MM-dd"))} />
      </BentoCard>
      <BentoCard title={dayTitle}>
        <DayGroups items={itemsOn(day)} day={day} renderRow={rowOf} onNewEvent={() => setCreating({ day })} />
      </BentoCard>
    </>
  )

  return (
    <LabelColorsProvider value={labels}>
    <div className="@container">
      <div className="grid min-w-0 grid-cols-1 gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] @min-[880px]:items-start">
        <div className="min-w-0">{main}</div>
        {/* From 880 px of content width (about a 1280 px screen with the sidebar open): the selected day and a mini month. */}
        {isMobile ? null : <aside className="flex min-w-0 flex-col gap-4 @min-[880px]:sticky @min-[880px]:top-0">{aside}</aside>}
      </div>

      <ResponsiveSheet open={Boolean(ask)} onOpenChange={(open) => !open && setAsk(null)} title="Excluir item que se repete" description={ask ? `“${ask.title}” se repete. O que excluir?` : undefined}>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => {
              if (ask) deleteRow(ask, "occurrence")
              setAsk(null)
            }}
          >
            Só esta ocorrência
          </Button>
          <Button
            type="button"
            className="h-11"
            onClick={() => {
              if (ask) deleteRow(ask, "series")
              setAsk(null)
            }}
          >
            Toda a série
          </Button>
        </div>
      </ResponsiveSheet>
      <EventDialog
        draft={creating}
        event={editing}
        onClose={() => {
          setCreating(null)
          setEditing(null)
        }}
        onSave={(event, isNew) => {
          setEvents((current) => (isNew ? [...current, event] : current.map((e) => (e.id === event.id ? event : e))))
          setSelected(null)
          toast.success(isNew ? "Evento criado." : "Evento atualizado.")
        }}
      />

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{KIND_META[selected.kind].label.replace(/s$/, "")}</DialogDescription>
              </DialogHeader>
              <dl className="flex flex-col gap-3 text-[15px] leading-6">
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
                  <dd>
                    {upperFirst(format(inTz(selected.start, TZ), "EEEE, d 'de' MMMM", { locale: ptBR }))} · {describeItemTime(selected)}
                  </dd>
                </div>
                {selectedEvent?.location || selected.detail ? (
                  <div className="flex items-center gap-3">
                    <MapPinIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
                    <dd>{selectedEvent?.location ?? selected.detail}</dd>
                  </div>
                ) : null}
                {selectedEvent ? (
                  <>
                    <div className="flex items-center gap-3">
                      <RepeatIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
                      <dd>{repeatLabel(selectedEvent.rrule)}</dd>
                    </div>
                    <div className="flex items-center gap-3">
                      <BellIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
                      <dd>
                        {selectedEvent.reminder_offsets.length === 0
                          ? "Sem lembrete"
                          : `Lembrete ${REMINDER_OPTIONS.find((o) => o.minutes === selectedEvent.reminder_offsets[0])?.label.toLowerCase() ?? ""}`}
                      </dd>
                    </div>
                    {selectedEvent.description ? <p className="max-w-[72ch] text-[15px] leading-6 text-muted-foreground">{selectedEvent.description}</p> : null}
                  </>
                ) : (
                  <p className="text-[13px] leading-5 text-muted-foreground">Este item vem de outro módulo. Edite por lá.</p>
                )}
              </dl>
              <DialogFooter>
                {selectedEvent ? (
                  <>
                    <Button variant="destructive" onClick={() => setToDelete(selectedEvent)}>
                      <Trash2Icon strokeWidth={1.75} /> Excluir evento
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(selectedEvent)
                        setSelected(null)
                      }}
                    >
                      <PencilIcon strokeWidth={1.75} /> Editar
                    </Button>
                  </>
                ) : null}
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir este evento?"
        description={toDelete?.rrule ? `“${toDelete.title}” e todas as repetições serão apagados.` : toDelete ? `“${toDelete.title}” será apagado.` : ""}
        onConfirm={confirmDelete}
      />
    </div>
    </LabelColorsProvider>
  )
}

// ------------------------------------------------------------------ month

export function MonthGrid({
  month,
  todayKey,
  selectedKey,
  itemsOn,
  onSelectDay,
  onOpenItem,
  onCreateOn,
  onDropItem,
}: {
  month: Date
  todayKey: string
  selectedKey: string
  itemsOn: (key: string) => AgendaItem[]
  onSelectDay: (key: string) => void
  onOpenItem: (item: AgendaItem) => void
  onCreateOn: (key: string, anchor?: DOMRect) => void
  /** Tasks only: an item (or a "Sem data" task) dropped on a day keeps its time. */
  onDropItem?: (id: string, key: string) => void
}) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })

  return (
    <div role="grid" aria-label="Calendário do mês" className="grid grid-cols-7 border-t border-l border-border">
      {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((name) => (
        <div key={name} role="columnheader" className="border-r border-b border-border py-2 text-center text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {name}
        </div>
      ))}
      {days.map((date) => {
        const key = format(date, "yyyy-MM-dd")
        const list = itemsOn(key)
        return (
          <div
            key={key}
            role="gridcell"
            aria-selected={key === selectedKey}
            title="Clique em um espaço vazio para criar um evento"
            onClick={(e) => {
              // An empty spot of the cell creates an event on that date; chips and the day number keep their own actions.
              if (!(e.target as HTMLElement).closest("button, [data-radix-popper-content-wrapper]")) onCreateOn(key, e.currentTarget.getBoundingClientRect())
            }}
            data-day-cell={key}
            onDragOver={onDropItem ? (e) => e.preventDefault() : undefined}
            onDrop={
              onDropItem
                ? (e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData("application/x-organizzou-task")
                    if (id) onDropItem(id, key)
                  }
                : undefined
            }
            className={cn(
              "flex min-h-16 cursor-cell flex-col gap-1 border-r border-b border-border p-1.5 md:min-h-24",
              !isSameMonth(date, month) && "text-muted-foreground",
              key === selectedKey && "bg-muted"
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={format(date, "d 'de' MMMM", { locale: ptBR })}
              className={cn(
                "tabular flex size-6 items-center justify-center self-start rounded-full text-[13px] leading-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                key === todayKey && "bg-highlight font-semibold text-highlight-foreground"
              )}
            >
              {format(date, "d")}
            </button>
            <span className="hidden flex-col gap-1 md:flex">
              {list.slice(0, 3).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-agenda-item={item.id}
                  draggable={Boolean(onDropItem) && item.kind === "task"}
                  onDragStart={(e) => e.dataTransfer.setData("application/x-organizzou-task", item.id)}
                  onClick={() => onOpenItem(item)}
                  style={itemStyle(item)}
                  className={cn("flex items-center gap-1 truncate rounded-md px-2 py-0.5 text-left text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", itemTone(), item.highlight && HIGHLIGHT)}
                >
                  <ItemIcon kind={item.kind} />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
              {list.length > 3 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" data-more-pill aria-label={`Mais ${list.length - 3} itens`} className="tabular relative inline-flex h-5 self-start items-center rounded-full bg-muted px-2 text-xs leading-4 text-foreground outline-none after:absolute after:-inset-y-1 after:inset-x-0 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                      +{list.length - 3}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 gap-1 p-2">
                    <p className="px-3 py-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    {list.map((item) => (
                      <button key={item.key} type="button" data-more-item onClick={() => onOpenItem(item)} style={itemStyle(item)} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50", itemTone())}>
                        <span className="tabular w-12 shrink-0 text-[13px] text-muted-foreground">{item.allDay ? "Dia todo" : formatTime(item.start)}</span>
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : null}
            </span>
            {list.length > 0 ? (
              <span className="tabular flex items-center gap-1 text-[11px] leading-4 text-muted-foreground md:hidden">
                <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
                {list.length}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function MiniMonth({
  month,
  todayKey,
  selectedKey,
  itemsOn,
  onSelectDay,
  onShift,
}: {
  month: Date
  todayKey: string
  selectedKey: string
  itemsOn: (key: string) => AgendaItem[]
  onSelectDay: (key: string) => void
  onShift: (n: -1 | 1) => void
}) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-medium">{upperFirst(format(month, "MMMM yyyy", { locale: ptBR }))}</span>
        <div className="flex">
          <Button variant="ghost" size="icon-sm" aria-label="Mês anterior" onClick={() => onShift(-1)}>
            <ChevronLeftIcon strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Próximo mês" onClick={() => onShift(1)}>
            <ChevronRightIcon strokeWidth={1.75} />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i} className="text-[11px] leading-5 text-muted-foreground">
            {d}
          </span>
        ))}
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd")
          const count = itemsOn(key).length
          const isSelected = key === selectedKey
          return (
            <button
              key={key}
              type="button"
              aria-label={format(date, "d 'de' MMMM", { locale: ptBR })}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(key)}
              className={cn(
                "tabular relative mx-auto flex size-9 items-center justify-center rounded-full text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                !isSameMonth(date, month) && "text-muted-foreground",
                key === todayKey ? "bg-highlight font-semibold text-highlight-foreground" : isSelected ? "border border-foreground/50" : "hover:bg-accent"
              )}
            >
              {format(date, "d")}
              {count > 0 && key !== todayKey ? <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-foreground" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------- mobile helpers

export function DayStrip({
  days,
  todayKey,
  selectedKey,
  itemsOn,
  onSelectDay,
}: {
  days: Date[]
  todayKey: string
  selectedKey: string
  itemsOn: (key: string) => AgendaItem[]
  onSelectDay: (key: string) => void
}) {
  return (
    <div className="mb-4 grid grid-cols-7 gap-1" role="group" aria-label="Dias da semana">
      {days.map((date) => {
        const key = format(date, "yyyy-MM-dd")
        return (
          <button
            key={key}
            type="button"
            aria-pressed={key === selectedKey}
            onClick={() => onSelectDay(key)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-full text-[13px] leading-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              key === selectedKey ? "bg-highlight text-highlight-foreground" : "hover:bg-accent"
            )}
          >
            <span className="text-[11px] leading-4 uppercase">{format(date, "EEE", { locale: ptBR }).slice(0, 3)}</span>
            <span className={cn("tabular text-[15px] font-semibold", key === todayKey && key !== selectedKey && "underline underline-offset-4")}>{format(date, "d")}</span>
            <span aria-hidden data-dots className="flex h-1.5 items-center gap-0.5">
              {itemsOn(key).slice(0, 3).map((item) => (
                <span key={item.key} className={cn("size-1.5 rounded-full", !itemColor(item) && "bg-current")} style={itemColor(item) ? { backgroundColor: itemColor(item)! } : undefined} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const GROUPS: { kind: AgendaKind; label: string; icon: LucideIcon }[] = [
  { kind: "task", label: "Tarefas", icon: SquareCheckIcon },
  { kind: "event", label: "Eventos", icon: CalendarDaysIcon },
  { kind: "workout", label: "Treinos", icon: DumbbellIcon },
  { kind: "study", label: "Estudos", icon: BookOpenIcon },
]
const GROUPS_KEY = "organizzou:agenda-groups"

/**
 * The selected day, VIEW mode: collapsible groups by calendar (chevron, name, count; no "+" and no ⋯), the shared card anatomy
 * (leading icon, one-line title, clock + time, place, left color bar, tinted) and ONE dashed "Novo evento…" pill at the end.
 * `flat` (phones/tablets): no surface around it, the groups sit on the page background.
 */
function DayGroups({ items, day, renderRow, onNewEvent, flat = false }: { items: AgendaItem[]; day: string; renderRow: (item: AgendaItem) => React.ReactNode; onNewEvent: () => void; flat?: boolean }) {
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      // localStorage only exists in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(JSON.parse(window.localStorage.getItem(GROUPS_KEY) ?? "{}") as Record<string, boolean>)
    } catch {
      setSaved({})
    }
  }, [])
  const toggle = (kind: string, open: boolean) => {
    const next = { ...saved, [kind]: !open }
    setSaved(next)
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  }
  return (
    <div data-testid="day-card" data-day={day} className={cn("flex flex-col", flat && "gap-0")}>
      {items.length === 0 ? <p className="py-2 text-[15px] leading-6 text-muted-foreground">Nada para este dia.</p> : null}
      {GROUPS.map(({ kind, label }) => {
        const list = items.filter((i) => i.kind === kind)
        const open = saved[kind] ?? list.length > 0
        return (
          <section key={kind} data-group={kind} aria-label={label} className={cn("flex flex-col", flat ? (open ? "mb-4" : "mb-2") : "mb-0.5")}>
            <GroupHeader label={label} count={list.length} open={open} onToggle={() => toggle(kind, open)} />
            <Collapse open={open}>
              <div data-group-rows className="flex flex-col gap-2 pb-2">{list.map((item) => renderRow(item))}</div>
            </Collapse>
          </section>
        )
      })}
      <button type="button" data-add-task-pill onClick={onNewEvent} className="mt-1 flex h-11 w-full items-center gap-2 rounded-full border border-dashed border-border px-4 text-[14px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <PlusIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
        Novo evento…
      </button>
    </div>
  )
}

const DAYS_KEY = "organizzou:agenda-days"

/**
 * Agenda mode: the next 30 days, one collapsible header per day with items ("Hoje · qua, 4 nov"), compact rows inside in chronological
 * order (all-day first). Today starts open and the rest closed; the toggles last for the session. `flat` (phones/tablets): the rows of
 * an expanded day live in one surface container.
 */
function AgendaDays({ from, todayKey, itemsOn, renderRow, flat }: { from: string; todayKey: string; itemsOn: (key: string) => AgendaItem[]; renderRow: (item: AgendaItem) => React.ReactNode; flat: boolean }) {
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      // sessionStorage only exists in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(JSON.parse(window.sessionStorage.getItem(DAYS_KEY) ?? "{}") as Record<string, boolean>)
    } catch {
      setSaved({})
    }
  }, [])
  const persist = (next: Record<string, boolean>) => {
    setSaved(next)
    try {
      window.sessionStorage.setItem(DAYS_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  }
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => format(addDays(parseISO(from), i), "yyyy-MM-dd")).filter((key) => itemsOn(key).length > 0)
  if (days.length === 0) return <p data-testid="agenda-empty" className="py-4 text-[15px] leading-6 text-muted-foreground">Nada nos próximos {AGENDA_DAYS} dias.</p>
  const isOpen = (key: string) => saved[key] ?? key === todayKey
  const allOpen = days.every(isOpen)
  const label = (key: string) => {
    const text = format(parseISO(key), "EEE, d MMM", { locale: ptBR }).replace(/\./g, "").toLowerCase()
    return key === todayKey ? `Hoje · ${text}` : text
  }
  return (
    <div data-testid="agenda-list" className="flex flex-col">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" data-testid="agenda-toggle-all" className="h-9 px-3 text-[13px] text-muted-foreground" onClick={() => persist(Object.fromEntries(days.map((key) => [key, !allOpen])))}>
          {allOpen ? "Recolher tudo" : "Expandir tudo"}
        </Button>
      </div>
      {days.map((key) => {
        const list = itemsOn(key)
        const open = isOpen(key)
        return (
          <section key={key} data-agenda-day={key} aria-label={label(key)} className={cn("flex flex-col", flat ? (open ? "mb-4" : "mb-2") : "mb-0.5")}>
            <GroupHeader label={label(key)} count={list.length} open={open} onToggle={() => persist({ ...saved, [key]: !open })} />
            <Collapse open={open}>
              <div data-group-rows className="flex flex-col gap-2 pb-2">
                {list.map((item) => renderRow(item))}
              </div>
            </Collapse>
          </section>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------- time grid

type DragState =
  | { mode: "create"; key: string; anchor: number; current: number; rect?: DOMRect }
  | { mode: "move"; item: AgendaItem; startKey: string; offsetMin: number; durationMin: number; key: string; top: number; moved: boolean }
  | { mode: "resize"; item: AgendaItem; key: string; startMin: number; endMin: number }

export function TimeGrid({
  days,
  todayKey,
  itemsOn,
  nowIso,
  onOpenItem,
  onSelectDay,
  onCreate,
  onMoveEvent,
  canDrag,
  single = false,
  onCreateAllDay,
  onDropTask,
}: {
  /** All-day row: a click on its empty part (tasks: a date-only task). */
  onCreateAllDay?: (key: string, anchor: DOMRect) => void
  /** A "Sem data" task dropped on a column: the day and the 15-minute slot ("HH:mm"), or null when dropped on the all-day row. */
  onDropTask?: (id: string, key: string, time: string | null) => void
  days: Date[]
  todayKey: string
  itemsOn: (key: string) => AgendaItem[]
  nowIso: string
  onOpenItem: (item: AgendaItem) => void
  onSelectDay?: (key: string) => void
  onCreate: (draft: Draft, anchor?: DOMRect) => void
  onMoveEvent: (id: string, start: Date, end: Date) => void
  canDrag: (item: AgendaItem) => boolean
  single?: boolean
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index)
  const gridHeight = hours.length * ROW_HEIGHT
  const nowMinutes = minutesOfDay(new Date(nowIso))
  const nowTop = ((nowMinutes - HOUR_START * 60) / 60) * ROW_HEIGHT
  // Day view: a readable column instead of one giant full-width bar.
  const columns = single ? "3.5rem minmax(0, 760px)" : `3.5rem repeat(${days.length}, minmax(0, 1fr))`
  const scroller = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  // Open on the current time (or the morning when today is not on screen).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const visibleToday = days.some((d) => format(d, "yyyy-MM-dd") === todayKey)
    el.scrollTop = Math.max(0, (visibleToday ? nowTop : 2 * ROW_HEIGHT) - el.clientHeight / 3)
    // Only when the set of days changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length, days[0]?.getTime()])

  const minuteAt = (clientY: number) => {
    const rect = columnsRef.current!.getBoundingClientRect()
    const raw = HOUR_START * 60 + ((clientY - rect.top + (scroller.current?.scrollTop ?? 0) * 0) / ROW_HEIGHT) * 60
    return Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, Math.round(raw / SNAP) * SNAP))
  }
  const dayKeyAt = (clientX: number, fallback: string) => {
    if (single) return fallback
    const rect = columnsRef.current!.getBoundingClientRect()
    const gutter = 56
    const width = (rect.width - gutter) / days.length
    const index = Math.max(0, Math.min(days.length - 1, Math.floor((clientX - rect.left - gutter) / width)))
    return format(days[index], "yyyy-MM-dd")
  }

  function startCreate(e: React.PointerEvent<HTMLDivElement>, key: string) {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    const m = minuteAt(e.clientY)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ mode: "create", key, anchor: m, current: m, rect: new DOMRect(e.clientX, e.clientY, 1, 1) })
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (d.mode === "create") setDrag({ ...d, current: minuteAt(e.clientY) })
    else if (d.mode === "move") {
      const top = minuteAt(e.clientY) - d.offsetMin
      setDrag({ ...d, key: dayKeyAt(e.clientX, d.key), top: Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - d.durationMin, Math.round(top / SNAP) * SNAP)), moved: true })
    } else if (d.mode === "resize") setDrag({ ...d, endMin: Math.max(d.startMin + SNAP, minuteAt(e.clientY)) })
  }

  function onPointerUp() {
    const d = dragRef.current
    setDrag(null)
    if (!d) return
    if (d.mode === "create") {
      const start = Math.min(d.anchor, d.current)
      const end = Math.abs(d.current - d.anchor) < SNAP ? start + 60 : Math.max(d.anchor, d.current)
      onCreate({ day: d.key, start: hhmm(start), end: hhmm(Math.min(end, 24 * 60 - 1)) }, d.rect)
    } else if (d.mode === "move") {
      if (!d.moved) return onOpenItem(d.item)
      const start = new Date(toDueIso(d.key, hhmm(d.top), TZ))
      onMoveEvent(d.item.id, start, new Date(start.getTime() + d.durationMin * 60_000))
    } else if (d.mode === "resize") {
      onMoveEvent(d.item.id, d.item.start, new Date(d.item.start.getTime() + (d.endMin - d.startMin) * 60_000))
    }
  }

  return (
    <div role="grid" aria-label="Agenda por horário" className="overflow-hidden rounded-2xl border border-border">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
        <div />
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd")
          const allDay = itemsOn(key).filter((i) => i.allDay)
          return (
            <div
              key={key}
              role="columnheader"
              data-allday-row={key}
              className="flex min-h-14 flex-col gap-1 border-l border-border px-2 py-2"
              onClick={(e) => {
                if (e.target === e.currentTarget) onCreateAllDay?.(key, e.currentTarget.getBoundingClientRect())
              }}
              onDragOver={onDropTask ? (e) => e.preventDefault() : undefined}
              onDrop={
                onDropTask
                  ? (e) => {
                      e.preventDefault()
                      const id = e.dataTransfer.getData("application/x-organizzou-task")
                      if (id) onDropTask(id, key, null)
                    }
                  : undefined
              }
            >
              <button
                type="button"
                disabled={!onSelectDay}
                onClick={() => onSelectDay?.(key)}
                className="flex items-center gap-2 rounded-full px-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{format(date, "EEE", { locale: ptBR }).slice(0, 3)}</span>
                <span className={cn("tabular flex size-7 items-center justify-center rounded-full text-[15px] leading-5 font-semibold", key === todayKey && "bg-highlight text-highlight-foreground")}>
                  {format(date, "d")}
                </span>
              </button>
              {allDay.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-agenda-item={item.id}
                  onClick={() => onOpenItem(item)}
                  style={itemStyle(item)}
                  className={cn("flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", itemTone(), item.highlight && HIGHLIGHT)}
                >
                  <ItemIcon kind={item.kind} />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div ref={scroller} className="relative max-h-[640px] scroll-soft overflow-y-auto">
        <div ref={columnsRef} className="relative grid" style={{ gridTemplateColumns: columns }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((hour, index) => (
              <span key={hour} className="tabular absolute right-2 -translate-y-1/2 text-[11px] leading-4 text-muted-foreground" style={{ top: index * ROW_HEIGHT }}>
                {index === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {days.map((date) => {
            const key = format(date, "yyyy-MM-dd")
            const timed = layoutDay(itemsOn(key).filter((i) => !i.allDay))
            const isToday = key === todayKey
            return (
              <div
                key={key}
                role="gridcell"
                aria-label={`${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}: arraste em um espaço vazio para criar um evento`}
                className="relative cursor-cell touch-none border-l border-border"
                style={{ height: gridHeight }}
                data-time-column={key}
                onPointerDown={(e) => startCreate(e, key)}
                onDragOver={onDropTask ? (e) => e.preventDefault() : undefined}
                onDrop={
                  onDropTask
                    ? (e) => {
                        e.preventDefault()
                        const id = e.dataTransfer.getData("application/x-organizzou-task")
                        if (id) onDropTask(id, key, hhmm(minuteAt(e.clientY)))
                      }
                    : undefined
                }
              >
                {hours.map((hour, index) => (
                  <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ top: index * ROW_HEIGHT }} />
                ))}
                {isToday && nowTop >= 0 && nowTop <= gridHeight ? (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }} aria-hidden>
                    <span className="tabular -ml-px rounded-full bg-highlight px-1.5 text-[10px] leading-4 font-semibold text-highlight-foreground">agora</span>
                    <span className="h-0.5 flex-1 bg-highlight" />
                  </div>
                ) : null}

                {drag?.mode === "create" && drag.key === key ? (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border border-foreground/50 bg-muted/80 px-2 py-1 text-xs leading-4"
                    style={{
                      top: ((Math.min(drag.anchor, drag.current) - HOUR_START * 60) / 60) * ROW_HEIGHT,
                      height: Math.max(SNAP, Math.abs(drag.current - drag.anchor) || 60) * (ROW_HEIGHT / 60),
                    }}
                  >
                    {hhmm(Math.min(drag.anchor, drag.current))} – {hhmm(Math.abs(drag.current - drag.anchor) < SNAP ? Math.min(drag.anchor, drag.current) + 60 : Math.max(drag.anchor, drag.current))}
                  </div>
                ) : null}

                {timed.map(({ item, column, columns: lanes }) => {
                  const draggable = canDrag(item)
                  const moving = drag?.mode === "move" && drag.item.key === item.key
                  const resizing = drag?.mode === "resize" && drag.item.key === item.key
                  if (moving && drag.key !== key) return null
                  const startMin = moving ? drag.top : minutesOfDay(item.start)
                  const top = Math.max(0, ((startMin - HOUR_START * 60) / 60) * ROW_HEIGHT)
                  const durationMin = resizing ? drag.endMin - drag.startMin : (item.end.getTime() - item.start.getTime()) / 60_000
                  const height = Math.max(24, (durationMin / 60) * ROW_HEIGHT - 2)
                  return (
                    <div
                      key={item.key}
                      data-agenda-item={item.id}
                      className={cn("absolute flex flex-col overflow-hidden rounded-lg px-2 py-1 text-left text-xs leading-4", itemTone(), moving && "z-30 opacity-80 ring-2 ring-foreground/40", item.highlight && HIGHLIGHT)}
                      style={{ ...itemStyle(item), top, height, left: `calc(${(column / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                    >
                      <button
                        type="button"
                        aria-label={`${item.title}, ${describeItemTime(item)}`}
                        className={cn("absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50", draggable ? "cursor-grab" : "cursor-pointer")}
                        onClick={() => {
                          if (!draggable) onOpenItem(item)
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && draggable) {
                            e.preventDefault()
                            onOpenItem(item)
                          }
                        }}
                        onPointerDown={(e) => {
                          if (!draggable || e.button !== 0) return
                          e.stopPropagation()
                          e.currentTarget.setPointerCapture(e.pointerId)
                          const m = minuteAt(e.clientY)
                          setDrag({ mode: "move", item, startKey: key, key, offsetMin: m - minutesOfDay(item.start), durationMin: (item.end.getTime() - item.start.getTime()) / 60_000, top: minutesOfDay(item.start), moved: false })
                        }}
                      />
                      <span className="pointer-events-none relative flex items-center gap-1 font-medium">
                        <ItemIcon kind={item.kind} />
                        <span className="truncate">{item.title}</span>
                      </span>
                      {height > 40 ? <span className="tabular pointer-events-none relative opacity-80">{describeItemTime(item)}</span> : null}
                      {draggable ? (
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            e.currentTarget.setPointerCapture(e.pointerId)
                            setDrag({ mode: "resize", item, key, startMin: minutesOfDay(item.start), endMin: minutesOfDay(item.end) })
                          }}
                        />
                      ) : null}
                    </div>
                  )
                })}
                {/* Ghost of an event being moved into this column. */}
                {drag?.mode === "move" && drag.key === key && !timed.some((t) => t.item.key === drag.item.key) ? (
                  <div
                    className={cn("pointer-events-none absolute inset-x-1 z-30 rounded-lg px-2 py-1 text-xs leading-4 opacity-80 ring-2 ring-foreground/40", itemTone())}
                    style={{ top: ((drag.top - HOUR_START * 60) / 60) * ROW_HEIGHT, height: Math.max(24, (drag.durationMin / 60) * ROW_HEIGHT - 2) }}
                  >
                    {drag.item.title}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ event dialog

function EventDialog({
  draft,
  event,
  onClose,
  onSave,
}: {
  draft: Draft | null
  event: EventRow | null
  onClose: () => void
  onSave: (event: EventRow, isNew: boolean) => void
}) {
  const open = Boolean(draft || event)
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92dvh] scroll-soft overflow-y-auto">
        {open ? <EventForm key={event?.id ?? `${draft?.day}-${draft?.start}`} draft={draft} event={event} onClose={onClose} onSave={onSave} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function EventForm({
  draft,
  event,
  onClose,
  onSave,
}: {
  draft: Draft | null
  event: EventRow | null
  onClose: () => void
  onSave: (event: EventRow, isNew: boolean) => void
}) {
  const startLocal = event ? inTz(new Date(event.starts_at), TZ) : null
  const endLocal = event ? inTz(new Date(event.ends_at), TZ) : null
  const [title, setTitle] = useState(event?.title ?? "")
  const [date, setDate] = useState(event ? dayKey(new Date(event.starts_at), TZ) : (draft?.day ?? ""))
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [start, setStart] = useState(startLocal ? hhmm(startLocal.getHours() * 60 + startLocal.getMinutes()) : (draft?.start ?? "09:00"))
  const [end, setEnd] = useState(endLocal ? hhmm(endLocal.getHours() * 60 + endLocal.getMinutes()) : (draft?.end ?? "10:00"))
  const [category, setCategory] = useState(event?.category ?? "")
  const [location, setLocation] = useState(event?.location ?? "")
  const [notes, setNotes] = useState(event?.description ?? "")
  const labels = useLabelColors()
  // The shared ColorPicker: a color saved locally (the new defaults and custom colors), else the legacy swatch the event was saved with.
  const [color, setColor] = useState<ColorValue>(event ? (labels.colorOf("event", event.id) ?? (event.swatch !== "neutro" ? event.swatch : null)) : null)
  const [repeat, setRepeat] = useState<string>(REPEAT_OPTIONS.find((o) => o.rrule === (event?.rrule ?? null))?.value ?? "none")
  const [reminder, setReminder] = useState<string>(REMINDER_OPTIONS.find((o) => o.minutes === (event?.reminder_offsets[0] ?? null))?.value ?? "none")

  const invalid = !title.trim() || (!allDay && end <= start)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (invalid) return
        const stamp = new Date().toISOString()
        const minutes = REMINDER_OPTIONS.find((o) => o.value === reminder)?.minutes ?? null
        const id = event?.id ?? newId()
        labels.setColor("event", id, color)
        // The column only accepts the legacy swatches; the rest of the colors live in the label store until the migration is applied.
        const column = (color && ["lima", "lima-verso", "tinta-verso", "grafite", "papel"].includes(color) ? color : "neutro") as SwatchId
        onSave(
          {
            id,
            user_id: event?.user_id ?? "00000000-0000-4000-8000-000000000001",
            title: title.trim(),
            starts_at: toDueIso(date, allDay ? "00:00" : start, TZ),
            ends_at: toDueIso(date, allDay ? "23:59" : end, TZ),
            all_day: allDay,
            description: notes.trim() || null,
            location: location.trim() || null,
            category: category.trim() || null,
            swatch: column,
            rrule: REPEAT_OPTIONS.find((o) => o.value === repeat)?.rrule ?? null,
            reminder_offsets: minutes ? [minutes] : [],
            created_at: event?.created_at ?? stamp,
            updated_at: stamp,
          },
          !event
        )
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
        <DialogDescription className="sr-only">{event ? "Edite o evento." : "Crie um evento na agenda."}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="event-title">Título</Label>
        <Input id="event-title" autoFocus value={title} maxLength={120} placeholder="Ex.: Jantar com a família" onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-2 @min-[560px]:col-span-1">
          <Label htmlFor="event-date">Data</Label>
          <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label className="col-span-2 flex min-h-11 items-center justify-between gap-3 text-[15px] @min-[560px]:col-span-1 sm:self-end">
          Dia inteiro
          <Switch checked={allDay} onCheckedChange={setAllDay} />
        </label>
        {!allDay ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-start">Início</Label>
              <Input id="event-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-end">Fim</Label>
              <Input id="event-end" type="time" value={end} aria-invalid={end <= start} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="event-category">Categoria</Label>
          <Input id="event-category" value={category} maxLength={40} placeholder="Ex.: Trabalho" onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="event-location">Local</Label>
          <Input id="event-location" value={location} maxLength={80} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="event-repeat">Repetição</Label>
          <Select value={repeat} onValueChange={setRepeat}>
            <SelectTrigger id="event-repeat" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPEAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="event-reminder">Lembrete</Label>
          <Select value={reminder} onValueChange={setReminder}>
            <SelectTrigger id="event-reminder" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="col-span-2 -mt-2 text-[13px] leading-5 text-muted-foreground">Os lembretes chegam pelo app, na hora que você escolher.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="event-notes">Notas</Label>
        <Textarea id="event-notes" value={notes} maxLength={1000} placeholder="Detalhes, links, o que levar" onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Cor do evento{resolveHex(color) ? <span className="ml-2 inline-block size-2 rounded-full align-middle ring-1 ring-foreground/25" style={{ backgroundColor: resolveHex(color)! }} /> : null}</Label>
        <ColorPicker label="Cor do evento" value={color} onChange={setColor} custom={labels.state.custom} onSaveCustom={labels.addCustom} onRemoveCustom={labels.removeCustom} />
        <p className="px-1 text-[13px] leading-5 text-muted-foreground">Aparece no cartão e no calendário.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={invalid}>
          {event ? "Salvar" : "Criar evento"}
        </Button>
      </DialogFooter>
    </form>
  )
}
