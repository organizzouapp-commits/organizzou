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
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DumbbellIcon,
  GraduationCapIcon,
  LayersIcon,
  MapPinIcon,
  PencilIcon,
  RepeatIcon,
  SquareCheckIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { BentoCard } from "@/components/organizzou/Bento"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { SwatchPicker } from "@/components/organizzou/SwatchPicker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
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

type View = "mes" | "semana" | "dia" | "agenda"

const TZ = MOCK_TIMEZONE
const HOUR_START = 6
const HOUR_END = 23
const ROW_HEIGHT = 56
const SNAP = 15 // minutes

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

function itemTone(item: AgendaItem) {
  return item.swatch === "neutro" ? "bg-secondary text-secondary-foreground" : getSwatch(item.swatch).chip
}

/** What the "new event" dialog starts with: a day, and optionally the time range picked on the grid. */
type Draft = { day: string; start?: string; end?: string }

export function AgendaScreen({ nowIso }: { nowIso: string }) {
  const todayKey = dayOf(nowIso)
  const isMobile = useIsMobile()
  const [view, setView] = useState<View>("semana")
  const [day, setDay] = useState(todayKey)
  const [events, setEvents] = useState<EventRow[]>(() => buildMockEvents(nowIso))
  const [kinds, setKinds] = useState<Set<AgendaKind>>(new Set(["event", "task", "workout", "study"]))
  const [creating, setCreating] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [toDelete, setToDelete] = useState<EventRow | null>(null)

  // One range covers every view: the month grid that contains the selected day (week and day views always fall inside it).
  const gridFrom = startOfWeek(startOfMonth(parseISO(day)))
  const gridTo = addDays(endOfWeek(endOfMonth(parseISO(day))), 1)

  // ------------------------------------------------ gather items from every module
  function collect(from: Date, to: Date): AgendaItem[] {
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
      items.push({ key: slot.id, kind: slot.kind, id: slot.id, title: slot.title, start, end: new Date(slot.end), allDay: false, swatch: "neutro", detail: slot.detail, editable: false })
    }
    return items
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => collect(gridFrom, gridTo), [events, kinds, day, nowIso])
  const sortItems = (list: AgendaItem[]) => [...list].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
  const itemsOn = (key: string) => sortItems(items.filter((item) => dayKey(item.start, TZ) === key))
  const todayItems = sortItems(collect(new Date(toDueIso(todayKey, "00:00", TZ)), new Date(toDueIso(format(addDays(parseISO(todayKey), 1), "yyyy-MM-dd"), "00:00", TZ))))

  // --------------------------------------------------------------- navigation
  function shift(direction: -1 | 1) {
    const date = parseISO(day)
    const next = view === "mes" ? addMonths(date, direction) : view === "semana" ? addWeeks(date, direction) : addDays(date, direction)
    setDay(format(next, "yyyy-MM-dd"))
  }

  const weekStart = startOfWeek(parseISO(day))
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  const title =
    view === "mes"
      ? upperFirst(format(parseISO(day), "MMMM 'de' yyyy", { locale: ptBR }))
      : view === "semana"
        ? `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM yyyy", { locale: ptBR })}`
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

  const effectiveView: View = isMobile && view === "dia" ? "dia" : view

  const controls = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" onClick={() => setDay(todayKey)}>
          Hoje
        </Button>
        <Button variant="ghost" size="icon" aria-label="Anterior" onClick={() => shift(-1)}>
          <ChevronLeftIcon strokeWidth={1.75} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Próximo" onClick={() => shift(1)}>
          <ChevronRightIcon strokeWidth={1.75} />
        </Button>
      </div>
      <h2 className="min-w-0 flex-1 basis-full text-xl leading-7 font-semibold tracking-[-0.01em] md:basis-40 md:truncate">{title}</h2>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <LayersIcon strokeWidth={1.75} /> Calendários
            {kinds.size < 4 ? <span className="tabular text-muted-foreground">{kinds.size}/4</span> : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 gap-1 p-2">
          {(Object.keys(KIND_META) as AgendaKind[]).map((kind) => (
            <label key={kind} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-accent">
              <Checkbox checked={kinds.has(kind)} onCheckedChange={() => toggleKind(kind)} />
              {KIND_META[kind].label}
            </label>
          ))}
        </PopoverContent>
      </Popover>
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList aria-label="Visão">
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="dia">Dia</TabsTrigger>
          <TabsTrigger value="agenda" className="md:hidden">
            Agenda
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )

  const main = (
    <BentoCard>
      <div className="flex flex-col gap-5">
        {controls}

        {effectiveView === "mes" ? (
          <MonthGrid
            month={parseISO(day)}
            todayKey={todayKey}
            selectedKey={day}
            itemsOn={itemsOn}
            onSelectDay={setDay}
            onOpenItem={setSelected}
            onCreateOn={(key) => setCreating({ day: key })}
          />
        ) : null}

        {effectiveView === "semana" ? (
          <>
            <div className="hidden md:block">
              <TimeGrid
                days={weekDays}
                todayKey={todayKey}
                itemsOn={itemsOn}
                nowIso={nowIso}
                onOpenItem={setSelected}
                onSelectDay={(key) => {
                  setDay(key)
                  setView("dia")
                }}
                onCreate={setCreating}
                onMoveEvent={moveEvent}
                canDrag={canDrag}
              />
            </div>
            <div className="md:hidden">
              <DayStrip days={weekDays} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} />
              <DayAgenda items={itemsOn(day)} onOpenItem={setSelected} />
            </div>
          </>
        ) : null}

        {effectiveView === "dia" ? (
          <>
            <div className="hidden md:block">
              <TimeGrid
                days={[parseISO(day)]}
                todayKey={todayKey}
                itemsOn={itemsOn}
                nowIso={nowIso}
                onOpenItem={setSelected}
                onCreate={setCreating}
                onMoveEvent={moveEvent}
                canDrag={canDrag}
                single
              />
            </div>
            <div className="md:hidden">
              <DayAgenda items={itemsOn(day)} onOpenItem={setSelected} />
            </div>
          </>
        ) : null}

        {effectiveView === "agenda" ? <UpcomingList from={day} items={items} itemsOn={itemsOn} onOpenItem={setSelected} /> : null}
      </div>
    </BentoCard>
  )

  const aside = (
    <>
      <BentoCard title="Calendário">
        <MiniMonth month={parseISO(day)} todayKey={todayKey} selectedKey={day} itemsOn={itemsOn} onSelectDay={setDay} onShift={(n) => setDay(format(addMonths(parseISO(day), n), "yyyy-MM-dd"))} />
      </BentoCard>
      <BentoCard title={upperFirst(format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR }))}>
        <DayAgenda items={itemsOn(day)} onOpenItem={setSelected} />
      </BentoCard>
      {day !== todayKey ? (
        <BentoCard title="Hoje">
          <DayAgenda items={todayItems} onOpenItem={setSelected} />
        </BentoCard>
      ) : null}
    </>
  )

  return (
    <div className="@container">
      <div className="grid min-w-0 grid-cols-1 gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] @min-[880px]:items-start">
        <div className="min-w-0">{main}</div>
        {/* From 880 px of content width (about a 1280 px screen with the sidebar open): the selected day and a mini month. */}
        <aside className={cn("flex min-w-0 flex-col gap-4 @min-[880px]:sticky @min-[880px]:top-0", effectiveView === "mes" ? "" : "")}>{aside}</aside>
      </div>

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
  onCreateOn,
}: {
  month: Date
  todayKey: string
  selectedKey: string
  itemsOn: (key: string) => AgendaItem[]
  onSelectDay: (key: string) => void
  onOpenItem: (item: AgendaItem) => void
  onCreateOn: (key: string) => void
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
              if (!(e.target as HTMLElement).closest("button, [data-radix-popper-content-wrapper]")) onCreateOn(key)
            }}
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
                  onClick={() => onOpenItem(item)}
                  className={cn("flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-xs leading-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", itemTone(item))}
                >
                  <ItemIcon kind={item.kind} />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
              {list.length > 3 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="self-start rounded-md px-1 text-xs leading-4 text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                      +{list.length - 3} mais
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 gap-1 p-2">
                    <p className="px-3 py-2 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    {list.map((item) => (
                      <button key={item.key} type="button" onClick={() => onOpenItem(item)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
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

function MiniMonth({
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
            <span className={cn("tabular text-[15px] font-semibold", key === todayKey && key !== selectedKey && "underline underline-offset-4")}>{format(date, "d")}</span>
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
          <span className="tabular w-16 shrink-0 text-[13px] leading-5 text-muted-foreground">{item.allDay ? "Dia todo" : formatTime(item.start)}</span>
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

/** Phones: "Agenda" tab, the next days one after the other like Google Calendar's schedule view. */
function UpcomingList({
  from,
  items,
  itemsOn,
  onOpenItem,
}: {
  from: string
  items: AgendaItem[]
  itemsOn: (key: string) => AgendaItem[]
  onOpenItem: (item: AgendaItem) => void
}) {
  const days = Array.from({ length: 21 }, (_, i) => format(addDays(parseISO(from), i), "yyyy-MM-dd")).filter((key) => itemsOn(key).length > 0)
  if (items.length === 0 || days.length === 0) return <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nada marcado nos próximos dias.</p>
  return (
    <div className="flex flex-col gap-4">
      {days.map((key) => (
        <section key={key} aria-label={key}>
          <h3 className="mb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{format(parseISO(key), "EEEE, d 'de' MMMM", { locale: ptBR })}</h3>
          <DayAgenda items={itemsOn(key)} onOpenItem={onOpenItem} />
        </section>
      ))}
    </div>
  )
}

// -------------------------------------------------------------- time grid

type DragState =
  | { mode: "create"; key: string; anchor: number; current: number }
  | { mode: "move"; item: AgendaItem; startKey: string; offsetMin: number; durationMin: number; key: string; top: number; moved: boolean }
  | { mode: "resize"; item: AgendaItem; key: string; startMin: number; endMin: number }

function TimeGrid({
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
}: {
  days: Date[]
  todayKey: string
  itemsOn: (key: string) => AgendaItem[]
  nowIso: string
  onOpenItem: (item: AgendaItem) => void
  onSelectDay?: (key: string) => void
  onCreate: (draft: Draft) => void
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
    setDrag({ mode: "create", key, anchor: m, current: m })
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
      onCreate({ day: d.key, start: hhmm(start), end: hhmm(Math.min(end, 24 * 60 - 1)) })
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
            <div key={key} role="columnheader" className="flex flex-col gap-1 border-l border-border px-2 py-2">
              <button
                type="button"
                disabled={!onSelectDay}
                onClick={() => onSelectDay?.(key)}
                className="flex items-center gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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

      <div ref={scroller} className="relative max-h-[640px] overflow-y-auto">
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
                onPointerDown={(e) => startCreate(e, key)}
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
                      className={cn("absolute flex flex-col overflow-hidden rounded-lg px-2 py-1 text-left text-xs leading-4", itemTone(item), moving && "z-30 opacity-80 ring-2 ring-foreground/40")}
                      style={{ top, height, left: `calc(${(column / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
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
                    className={cn("pointer-events-none absolute inset-x-1 z-30 rounded-lg px-2 py-1 text-xs leading-4 opacity-80 ring-2 ring-foreground/40", itemTone(drag.item))}
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
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
  const [swatch, setSwatch] = useState<SwatchId>(event?.swatch ?? "neutro")
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
        onSave(
          {
            id: event?.id ?? mockId("evt"),
            user_id: event?.user_id ?? "00000000-0000-4000-8000-000000000001",
            title: title.trim(),
            starts_at: toDueIso(date, allDay ? "00:00" : start, TZ),
            ends_at: toDueIso(date, allDay ? "23:59" : end, TZ),
            all_day: allDay,
            description: notes.trim() || null,
            location: location.trim() || null,
            category: category.trim() || null,
            swatch,
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
        <p className="col-span-2 -mt-2 text-[13px] leading-5 text-muted-foreground">Em breve: os lembretes chegam pelo app e pelo WhatsApp. Por enquanto só ficam anotados no evento.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="event-notes">Notas</Label>
        <Textarea id="event-notes" value={notes} maxLength={1000} placeholder="Detalhes, links, o que levar" onChange={(e) => setNotes(e.target.value)} />
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
          {event ? "Salvar" : "Criar evento"}
        </Button>
      </DialogFooter>
    </form>
  )
}
