"use client"

import { useState } from "react"
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
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DumbbellIcon,
  GraduationCapIcon,
  MapPinIcon,
  RepeatIcon,
  SquareCheckIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { SwatchPicker } from "@/components/organizzou/SwatchPicker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { expandEvent, layoutDay, REPEAT_OPTIONS, repeatLabel } from "@/features/calendar/recurrence"
import type { AgendaItem, AgendaKind, EventRow } from "@/features/calendar/types"
import { dayKey, inTz, toDueIso } from "@/lib/dates"
import type { SwatchId } from "@/lib/swatches"
import { getSwatch } from "@/lib/swatches"
import { cn } from "@/lib/utils"
import { buildMockEvents } from "@/mocks/calendar"
import { mockStudySlots, mockWorkoutSlots } from "@/mocks/schedule"
import { getMockBoardsStore } from "@/mocks/tasks-api"
import { dayOf, MOCK_TIMEZONE, mockId } from "@/mocks/time"

type View = "mes" | "semana" | "dia"

const TZ = MOCK_TIMEZONE
const HOUR_START = 6
const HOUR_END = 23
const ROW_HEIGHT = 56

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

function formatTime(date: Date) {
  const local = inTz(date, TZ)
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
}

function describeItemTime(item: AgendaItem) {
  return item.allDay ? "Dia inteiro" : `${formatTime(item.start)} – ${formatTime(item.end)}`
}

function rangeFor(view: View, day: string) {
  const date = parseISO(day)
  let from: Date
  let to: Date
  if (view === "mes") {
    from = startOfWeek(startOfMonth(date))
    to = addDays(endOfWeek(endOfMonth(date)), 1)
  } else if (view === "semana") {
    from = startOfWeek(date)
    to = addDays(from, 7)
  } else {
    from = date
    to = addDays(date, 1)
  }
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
}

function ItemIcon({ kind, className }: { kind: AgendaKind; className?: string }) {
  const Icon = KIND_META[kind].icon
  return Icon ? <Icon aria-hidden strokeWidth={1.75} className={className ?? "size-3 shrink-0"} /> : null
}

function itemTone(item: AgendaItem) {
  return item.swatch === "neutro" ? "bg-secondary text-secondary-foreground" : getSwatch(item.swatch).chip
}

export function AgendaScreen({ nowIso }: { nowIso: string }) {
  const todayKey = dayOf(nowIso)
  const [view, setView] = useState<View>("semana")
  const [day, setDay] = useState(todayKey)
  const [events, setEvents] = useState<EventRow[]>(() => buildMockEvents(nowIso))
  const [kinds, setKinds] = useState<Set<AgendaKind>>(new Set(["event", "task", "workout", "study"]))
  const [creating, setCreating] = useState<string | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [toDelete, setToDelete] = useState<EventRow | null>(null)

  const range = rangeFor(view, day)
  const from = new Date(toDueIso(range.from, "00:00", TZ))
  const to = new Date(toDueIso(range.to, "00:00", TZ))

  // ------------------------------------------------ gather items from every module
  const items: AgendaItem[] = []
  if (kinds.has("event")) for (const event of events) items.push(...expandEvent(event, from, to, TZ))
  if (kinds.has("task")) {
    for (const board of getMockBoardsStore(nowIso).boards) {
      for (const task of board.tasks) {
        if (!task.due_at || task.completed_at) continue
        const start = new Date(task.due_at)
        if (start < from || start >= to) continue
        items.push({
          key: `task:${task.id}`,
          kind: "task",
          id: task.id,
          title: task.title,
          start,
          end: new Date(start.getTime() + 30 * 60_000),
          allDay: !task.due_has_time,
          swatch: "neutro",
          detail: board.board.name,
          editable: false,
        })
      }
    }
  }
  const slots = [
    ...(kinds.has("workout") ? mockWorkoutSlots(nowIso).map((s) => ({ ...s, kind: "workout" as const })) : []),
    ...(kinds.has("study") ? mockStudySlots(nowIso).map((s) => ({ ...s, kind: "study" as const })) : []),
  ]
  for (const slot of slots) {
    const start = new Date(slot.start)
    if (start < from || start >= to) continue
    items.push({
      key: slot.id,
      kind: slot.kind,
      id: slot.id,
      title: slot.title,
      start,
      end: new Date(slot.end),
      allDay: false,
      swatch: "neutro",
      detail: slot.detail,
      editable: false,
    })
  }
  const itemsOn = (key: string) =>
    items
      .filter((item) => dayKey(item.start, TZ) === key)
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())

  // --------------------------------------------------------------- navigation
  function shift(direction: -1 | 1) {
    const date = parseISO(day)
    const next = view === "mes" ? addMonths(date, direction) : view === "semana" ? addWeeks(date, direction) : addDays(date, direction)
    setDay(format(next, "yyyy-MM-dd"))
  }

  const title =
    view === "mes"
      ? upperFirst(format(parseISO(day), "MMMM 'de' yyyy", { locale: ptBR }))
      : view === "semana"
        ? `${format(parseISO(range.from), "d MMM", { locale: ptBR })} – ${format(addDays(parseISO(range.to), -1), "d MMM yyyy", { locale: ptBR })}`
        : upperFirst(format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }))

  function toggleKind(kind: AgendaKind) {
    setKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  function openItem(item: AgendaItem) {
    setSelected(item)
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

  const weekDays = eachDayOfInterval({ start: parseISO(range.from), end: addDays(parseISO(range.to), -1) })

  usePrimaryAction("Novo evento", () => setCreating(day))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />
      <Bento>
      <BentoCard className={cn("col-span-12", view === "mes" && "@min-[900px]:col-span-8")}>
      <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="dia">Dia</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Anterior" onClick={() => shift(-1)}>
            <ChevronLeftIcon strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" onClick={() => setDay(todayKey)}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" aria-label="Próximo" onClick={() => shift(1)}>
            <ChevronRightIcon strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">{title}</h2>
        <div className="flex flex-wrap items-center gap-4" role="group" aria-label="Mostrar na agenda">
          {(Object.keys(KIND_META) as AgendaKind[]).map((kind) => (
            <label key={kind} className="flex min-h-11 items-center gap-2 text-[13px] leading-5 md:min-h-8">
              <Checkbox checked={kinds.has(kind)} onCheckedChange={() => toggleKind(kind)} />
              {KIND_META[kind].label}
            </label>
          ))}
        </div>
      </div>

      {view === "mes" ? (
        <MonthGrid
          month={parseISO(day)}
          todayKey={todayKey}
          selectedKey={day}
          itemsOn={itemsOn}
          onSelectDay={(key) => setDay(key)}
          onOpenItem={openItem}
        />
      ) : null}

      {view === "semana" ? (
        <>
          <div className="hidden md:block">
            <TimeGrid days={weekDays} todayKey={todayKey} itemsOn={itemsOn} nowIso={nowIso} onOpenItem={openItem} onSelectDay={(key) => { setDay(key); setView("dia") }} />
          </div>
          <div className="md:hidden">
            <DayStrip days={weekDays} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} />
            <DayAgenda items={itemsOn(day)} onOpenItem={openItem} />
          </div>
        </>
      ) : null}

      {view === "dia" ? (
        <>
          <div className="hidden md:block">
            <TimeGrid days={[parseISO(day)]} todayKey={todayKey} itemsOn={itemsOn} nowIso={nowIso} onOpenItem={openItem} />
          </div>
          <div className="md:hidden">
            <DayAgenda items={itemsOn(day)} onOpenItem={openItem} />
          </div>
        </>
      ) : null}

      </div>
      </BentoCard>
      {view === "mes" ? (
        <BentoCard title={upperFirst(format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }))} className="col-span-12 @min-[1000px]:col-span-4">
          <DayAgenda items={itemsOn(day)} onOpenItem={openItem} />
        </BentoCard>
      ) : null}
      </Bento>

      <NewEventDialog
        day={creating}
        onClose={() => setCreating(null)}
        onCreate={(event) => {
          setEvents((current) => [...current, event])
          toast.success("Evento criado.")
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
                  </>
                ) : (
                  <p className="text-[13px] leading-5 text-muted-foreground">
                    Este item vem de outro módulo. Edite por lá.
                  </p>
                )}
              </dl>
              <DialogFooter>
                {selectedEvent ? (
                  <Button variant="destructive" onClick={() => setToDelete(selectedEvent)}>
                    <Trash2Icon strokeWidth={1.75} /> Excluir evento
                  </Button>
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
  )
}

// ------------------------------------------------------------------ month

function MonthGrid({
  month,
  todayKey,
  selectedKey,
  itemsOn,
  onSelectDay,
  onOpenItem,
}: {
  month: Date
  todayKey: string
  selectedKey: string
  itemsOn: (key: string) => AgendaItem[]
  onSelectDay: (key: string) => void
  onOpenItem: (item: AgendaItem) => void
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
            className={cn(
              "flex min-h-16 flex-col gap-1 border-r border-b border-border p-1.5 md:min-h-28",
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
                  onClick={() => onOpenItem(item)}
                  className={cn("flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", itemTone(item))}
                >
                  <ItemIcon kind={item.kind} />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
              {list.length > 3 ? <span className="px-1 text-xs leading-4 text-muted-foreground">+{list.length - 3}</span> : null}
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

// ----------------------------------------------------------- mobile helpers

function DayStrip({
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
        const count = itemsOn(key).length
        return (
          <button
            key={key}
            type="button"
            aria-pressed={key === selectedKey}
            onClick={() => onSelectDay(key)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[13px] leading-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              key === selectedKey ? "bg-highlight text-highlight-foreground" : "hover:bg-accent"
            )}
          >
            <span className="text-[11px] leading-4 uppercase">{format(date, "EEE", { locale: ptBR }).slice(0, 3)}</span>
            <span className={cn("tabular text-[15px] font-semibold", key === todayKey && key !== selectedKey && "underline underline-offset-4")}>
              {format(date, "d")}
            </span>
            <span aria-hidden className={cn("size-1.5 rounded-full", count > 0 ? "bg-current" : "bg-transparent")} />
          </button>
        )
      })}
    </div>
  )
}

function DayAgenda({ items, onOpenItem }: { items: AgendaItem[]; onOpenItem: (item: AgendaItem) => void }) {
  if (items.length === 0) {
    return <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nada marcado para este dia.</p>
  }
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onOpenItem(item)}
          className="flex min-h-14 items-center gap-4 border-b border-border py-3 text-left outline-none last:border-b-0 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="tabular w-24 shrink-0 text-[13px] leading-5 text-muted-foreground">
            {item.allDay ? "Dia inteiro" : formatTime(item.start)}
          </span>
          <span aria-hidden className={cn("h-8 w-1 shrink-0 rounded-full", getSwatch(item.swatch).fill)} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2 text-[15px] leading-6">
              <ItemIcon kind={item.kind} className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{item.title}</span>
            </span>
            {item.detail ? <span className="truncate text-[13px] leading-5 text-muted-foreground">{item.detail}</span> : null}
          </span>
        </button>
      ))}
    </div>
  )
}

// -------------------------------------------------------------- time grid

function TimeGrid({
  days,
  todayKey,
  itemsOn,
  nowIso,
  onOpenItem,
  onSelectDay,
}: {
  days: Date[]
  todayKey: string
  itemsOn: (key: string) => AgendaItem[]
  nowIso: string
  onOpenItem: (item: AgendaItem) => void
  onSelectDay?: (key: string) => void
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index)
  const gridHeight = hours.length * ROW_HEIGHT
  const nowMinutes = minutesOfDay(new Date(nowIso))
  const nowTop = ((nowMinutes - HOUR_START * 60) / 60) * ROW_HEIGHT
  const columns = `3.5rem repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div role="grid" aria-label="Agenda por horário" className="overflow-hidden rounded-2xl border border-border">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
        <div />
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd")
          const allDay = itemsOn(key).filter((i) => i.allDay)
          return (
            <div key={key} role="columnheader" className="flex flex-col gap-1 border-l border-border px-2 py-2">
              <button
                type="button"
                disabled={!onSelectDay}
                onClick={() => onSelectDay?.(key)}
                className="flex items-center gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {format(date, "EEE", { locale: ptBR }).slice(0, 3)}
                </span>
                <span
                  className={cn(
                    "tabular flex size-7 items-center justify-center rounded-full text-[15px] leading-5 font-semibold",
                    key === todayKey && "bg-highlight text-highlight-foreground"
                  )}
                >
                  {format(date, "d")}
                </span>
              </button>
              {allDay.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className={cn("truncate rounded-md px-1.5 py-0.5 text-left text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", itemTone(item))}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div className="relative grid max-h-[620px] overflow-y-auto" style={{ gridTemplateColumns: columns }}>
        <div className="relative" style={{ height: gridHeight }}>
          {hours.map((hour, index) => (
            <span
              key={hour}
              className="tabular absolute right-2 -translate-y-1/2 text-[11px] leading-4 text-muted-foreground"
              style={{ top: index * ROW_HEIGHT }}
            >
              {index === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd")
          const timed = layoutDay(itemsOn(key).filter((i) => !i.allDay))
          return (
            <div key={key} role="gridcell" className="relative border-l border-border" style={{ height: gridHeight }}>
              {hours.map((hour, index) => (
                <div key={hour} className="absolute inset-x-0 border-t border-border" style={{ top: index * ROW_HEIGHT }} />
              ))}
              {key === todayKey && nowTop >= 0 && nowTop <= gridHeight ? (
                <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }} aria-hidden>
                  <span className="-ml-1 size-2 rounded-full bg-foreground" />
                  <span className="h-px flex-1 bg-foreground" />
                </div>
              ) : null}
              {timed.map(({ item, column, columns: lanes }) => {
                const top = Math.max(0, ((minutesOfDay(item.start) - HOUR_START * 60) / 60) * ROW_HEIGHT)
                const height = Math.max(24, ((item.end.getTime() - item.start.getTime()) / 3_600_000) * ROW_HEIGHT - 2)
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className={cn("absolute flex flex-col overflow-hidden rounded-lg px-2 py-1 text-left text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", itemTone(item))}
                    style={{ top, height, left: `calc(${(column / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                  >
                    <span className="flex items-center gap-1 font-medium">
                      <ItemIcon kind={item.kind} />
                      <span className="truncate">{item.title}</span>
                    </span>
                    {height > 40 ? <span className="tabular opacity-80">{describeItemTime(item)}</span> : null}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ------------------------------------------------------------ new event

function NewEventDialog({
  day,
  onClose,
  onCreate,
}: {
  day: string | null
  onClose: () => void
  onCreate: (event: EventRow) => void
}) {
  return (
    <Dialog open={Boolean(day)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{day ? <NewEventForm initialDay={day} onClose={onClose} onCreate={onCreate} /> : null}</DialogContent>
    </Dialog>
  )
}

function NewEventForm({
  initialDay,
  onClose,
  onCreate,
}: {
  initialDay: string
  onClose: () => void
  onCreate: (event: EventRow) => void
}) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(initialDay)
  const [allDay, setAllDay] = useState(false)
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("10:00")
  const [category, setCategory] = useState("")
  const [location, setLocation] = useState("")
  const [swatch, setSwatch] = useState<SwatchId>("neutro")
  const [repeat, setRepeat] = useState<string>("none")
  const [reminder, setReminder] = useState<string>("none")

  const invalid = !title.trim() || (!allDay && end <= start)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (invalid) return
        const stamp = new Date().toISOString()
        const minutes = REMINDER_OPTIONS.find((o) => o.value === reminder)?.minutes ?? null
        onCreate({
          id: mockId("evt"),
          user_id: "00000000-0000-4000-8000-000000000001",
          title: title.trim(),
          starts_at: toDueIso(date, allDay ? "00:00" : start, TZ),
          ends_at: toDueIso(date, allDay ? "23:59" : end, TZ),
          all_day: allDay,
          description: null,
          location: location.trim() || null,
          category: category.trim() || null,
          swatch,
          rrule: REPEAT_OPTIONS.find((o) => o.value === repeat)?.rrule ?? null,
          reminder_offsets: minutes ? [minutes] : [],
          created_at: stamp,
          updated_at: stamp,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo evento</DialogTitle>
        <DialogDescription className="sr-only">Crie um evento na agenda.</DialogDescription>
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
      </div>
      <div className="flex flex-col gap-2">
        <Label>Cor</Label>
        <SwatchPicker value={swatch} onChange={setSwatch} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={invalid}>
          Criar evento
        </Button>
      </DialogFooter>
    </form>
  )
}
