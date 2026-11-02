"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { CalendarDaysIcon, ChevronDownIcon, DumbbellIcon, GraduationCapIcon, PlusIcon, ReceiptTextIcon, RepeatIcon, SquareCheckIcon, TimerResetIcon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { useAssistant } from "@/components/assistant/assistant-context"
import { bentoCardClass } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { SwipeRow } from "@/components/organizzou/SwipeRow"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { completeTask, updateTask } from "@/features/tasks/actions"
import type { DayData, DayItem, DayItemKind } from "@/features/today/types"
import { isMock } from "@/mocks/config"
import { createMockBoardApi } from "@/mocks/tasks-api"
import { cn } from "@/lib/utils"

import { useTodayState } from "./today-state"

const TZ = "America/Sao_Paulo"
const MAX_ROWS = 8

const KIND_ICON: Record<DayItemKind, LucideIcon> = {
  task: SquareCheckIcon,
  event: CalendarDaysIcon,
  workout: DumbbellIcon,
  study: GraduationCapIcon,
  habit: RepeatIcon,
  bill: ReceiptTextIcon,
}

const FILTERS: { id: string; label: string; kinds: DayItemKind[] | null }[] = [
  { id: "tudo", label: "Tudo", kinds: null },
  { id: "tarefas", label: "Tarefas", kinds: ["task"] },
  { id: "agenda", label: "Agenda", kinds: ["event"] },
  { id: "habitos", label: "Hábitos", kinds: ["habit"] },
  { id: "treinos", label: "Treinos", kinds: ["workout"] },
  { id: "financas", label: "Finanças", kinds: ["bill"] },
  { id: "estudos", label: "Estudos", kinds: ["study"] },
]

type Period = "manha" | "tarde" | "noite" | "sem-horario"
const PERIODS: { id: Period; label: string }[] = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
  { id: "noite", label: "Noite" },
  { id: "sem-horario", label: "Sem horário" },
]

const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(iso))) % 24
const clock = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
const periodOfHour = (hour: number): Period => (hour < 12 ? "manha" : hour < 18 ? "tarde" : "noite")
const periodOf = (item: DayItem): Period => (item.at ? periodOfHour(hourOf(item.at)) : "sem-horario")

/** Step of the "+" button for a quantity habit: a natural amount per unit, never a fraction of the target. */
function stepFor(unit: string, target: number) {
  if (unit === "L") return 0.25
  if (unit === "min") return 10
  if (unit === "páginas") return 5
  return Math.max(1, Math.round(target / 4))
}
const number = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
const durationText = (min?: number) => (min ? (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`) : null)

function Overline({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">{children}</h3>
}

// ---------------------------------------------------------------------------------------------------------------------

type RowActions = {
  isDone: (item: DayItem) => boolean
  qtyOf: (item: DayItem) => number
  complete: (item: DayItem, done: boolean) => void
  addQty: (item: DayItem) => void
  postpone: (item: DayItem) => void
}

function DayRow({ item, actions }: { item: DayItem; actions: RowActions }) {
  const Icon = KIND_ICON[item.kind]
  const done = actions.isDone(item)
  const [menu, setMenu] = useState(false)
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined)
  const canPostpone = item.kind === "task" && !done
  const canComplete = item.action === "check"

  // A long press on a touch screen opens the same menu as the context-menu key / right click: the accessible way to "concluir" and "adiar".
  const startHold = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch" || (!canComplete && !canPostpone)) return
    hold.current = setTimeout(() => setMenu(true), 550)
  }
  const stopHold = () => clearTimeout(hold.current)
  useEffect(() => () => clearTimeout(hold.current), [])

  const time = item.at ? clock(item.at) : item.overdue ? "atraso" : ""
  const qty = item.habit ? actions.qtyOf(item) : 0
  const metaParts = [item.meta]
  const duration = durationText(item.durationMin)
  if (duration) metaParts.push(duration)
  if (item.habit) metaParts.push(`${number(qty)} de ${number(item.habit.target)} ${item.habit.unit}`)

  const row = (
    <div
      data-kind={item.kind}
      data-done={done ? "" : undefined}
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={(event) => {
        if (!canComplete && !canPostpone) return
        event.preventDefault()
        setMenu(true)
      }}
      className="relative flex min-h-14 items-center gap-3 border-b border-border py-3 last:border-b-0"
    >
      <span className="tabular w-[52px] shrink-0 text-[13px] leading-5 text-muted-foreground">{time}</span>
      <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
      <Link href={item.href} className="flex min-w-0 flex-1 flex-col rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className={cn("text-[15px] leading-6 break-words", done && "text-muted-foreground line-through")}>{item.title}</span>
        <span className="text-[13px] leading-5 break-words text-muted-foreground">{metaParts.join(" · ")}</span>
      </Link>

      {item.action === "check" ? (
        <span className="flex size-11 shrink-0 items-center justify-center">
          <Checkbox checked={done} onCheckedChange={(value) => actions.complete(item, value === true)} aria-label={done ? `Reabrir ${item.title}` : `Concluir ${item.title}`} className="after:-inset-3" />
        </span>
      ) : null}
      {item.action === "plus" ? (
        <Button type="button" variant="outline" size="icon" disabled={done} className="size-11 shrink-0 rounded-full" aria-label={`Adicionar ${number(stepFor(item.habit?.unit ?? "", item.habit?.target ?? 1))} ${item.habit?.unit ?? ""} a ${item.title}`} onClick={() => actions.addQty(item)}>
          <PlusIcon strokeWidth={1.75} />
        </Button>
      ) : null}
      {item.action === "pay" ? (
        <Button asChild variant="outline" className="h-11 shrink-0 rounded-full px-4">
          <Link href={item.href} aria-label={`Pagar ${item.title}`}>
            Pagar
          </Link>
        </Button>
      ) : null}

      {canComplete || canPostpone ? (
        <DropdownMenu open={menu} onOpenChange={setMenu}>
          <DropdownMenuTrigger asChild>
            <span aria-hidden tabIndex={-1} className="pointer-events-none absolute right-0 bottom-0 size-px" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52 rounded-2xl p-2">
            {canComplete ? (
              <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => actions.complete(item, !done)}>
                <SquareCheckIcon strokeWidth={1.75} /> {done ? "Reabrir" : "Concluir"}
              </DropdownMenuItem>
            ) : null}
            {canPostpone ? (
              <DropdownMenuItem className="min-h-11 gap-3 rounded-xl px-3 text-[15px]" onSelect={() => actions.postpone(item)}>
                <TimerResetIcon strokeWidth={1.75} /> Adiar para amanhã
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )

  // Swipe (touch only): right = concluir, left = adiar (tasks). The menu above is the non-gesture path.
  if ((canComplete && !done) || canPostpone) {
    return (
      <SwipeRow
        surfaceClassName="bg-card"
        onSwipeRight={canComplete && !done ? () => actions.complete(item, true) : undefined}
        rightLabel="Concluir"
        onSwipeLeft={canPostpone ? () => actions.postpone(item) : undefined}
        leftLabel="Adiar"
        leftIcon={TimerResetIcon}
      >
        {row}
      </SwipeRow>
    )
  }
  return row
}

function NowLine({ nowIso }: { nowIso: string }) {
  return (
    <div role="separator" aria-label={`Agora, ${clock(nowIso)}`} data-now className="flex items-center gap-3 py-1">
      <span className="tabular w-[52px] shrink-0 rounded-full bg-highlight px-2 py-0.5 text-center text-[11px] leading-4 font-semibold text-highlight-foreground">agora</span>
      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-highlight" />
    </div>
  )
}

function Section({ label, count, children, collapsible, open, onToggle }: { label: string; count?: number; children: React.ReactNode; collapsible?: boolean; open?: boolean; onToggle?: () => void }) {
  return (
    <section aria-label={label} className="flex flex-col">
      {collapsible ? (
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-11 items-center justify-between gap-2 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Overline>
            {label}
            {count !== undefined ? ` (${count})` : ""}
          </Overline>
          <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 text-muted-foreground transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      ) : (
        <div className="flex min-h-9 items-end pb-1">
          <Overline>{label}</Overline>
        </div>
      )}
      {!collapsible || open ? children : null}
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

export function SeuDia({ data }: { data: DayData }) {
  const state = useTodayState()
  const { openQuickCapture } = useAssistant()
  const [filter, setFilter] = useState("tudo")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [overdueOpen, setOverdueOpen] = useState(true)
  const [doneOpen, setDoneOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const isDone = (item: DayItem) => {
    if (item.habit) return (state.qty[item.id] ?? item.habit.qty) >= item.habit.target
    return state.done[item.id] ?? item.done ?? false
  }
  const qtyOf = (item: DayItem) => state.qty[item.id] ?? item.habit?.qty ?? 0

  async function persistTask(item: DayItem, run: () => Promise<{ ok: boolean }>, rollback: () => void) {
    if (item.kind !== "task") return
    try {
      const result = await run()
      if (!result.ok) throw new Error("save")
    } catch {
      rollback()
      toast.error("Não foi possível salvar. Tente de novo.")
    }
  }

  const actions: RowActions = {
    isDone,
    qtyOf,
    complete(item, done) {
      state.setDone(item.id, done)
      void persistTask(
        item,
        () => (isMock ? createMockBoardApi(data.nowIso).completeTask({ id: item.id, done }) : completeTask({ id: item.id, done })),
        () => state.setDone(item.id, !done)
      )
      toast(done ? "Concluído." : "Reaberto.", done ? { action: { label: "Desfazer", onClick: () => actions.complete(item, false) } } : undefined)
    },
    addQty(item) {
      if (!item.habit) return
      const next = Math.min(item.habit.target, Math.round((qtyOf(item) + stepFor(item.habit.unit, item.habit.target)) * 100) / 100)
      state.setQty(item.id, next)
      if (next >= item.habit.target) toast.success("Meta do dia atingida.")
    },
    postpone(item) {
      if (!item.due) return
      const moved = new Date(new Date(item.due.at).getTime() + 24 * 60 * 60_000).toISOString()
      state.postpone(item.id, true)
      void persistTask(
        item,
        () => (isMock ? createMockBoardApi(data.nowIso).updateTask({ id: item.id, patch: { dueAt: moved, dueHasTime: item.due!.hasTime } }) : updateTask({ id: item.id, patch: { dueAt: moved, dueHasTime: item.due!.hasTime } })),
        () => state.postpone(item.id, false)
      )
      toast("Adiado para amanhã.", {
        action: {
          label: "Desfazer",
          onClick: () => {
            state.postpone(item.id, false)
            void persistTask(
              item,
              () => (isMock ? createMockBoardApi(data.nowIso).updateTask({ id: item.id, patch: { dueAt: item.due!.at, dueHasTime: item.due!.hasTime } }) : updateTask({ id: item.id, patch: { dueAt: item.due!.at, dueHasTime: item.due!.hasTime } })),
              () => state.postpone(item.id, true)
            )
          },
        },
      })
    },
  }

  const kinds = FILTERS.find((f) => f.id === filter)?.kinds ?? null
  const visible = data.items.filter((item) => !state.postponed.has(item.id) && (!kinds || kinds.includes(item.kind)))
  const finished = visible.filter(isDone)
  const pending = visible.filter((item) => !isDone(item))
  const overdue = pending.filter((item) => item.overdue)
  const rest = pending.filter((item) => !item.overdue)

  const nowMs = new Date(data.nowIso).getTime()
  const nowPeriod = periodOfHour(hourOf(data.nowIso))
  const byPeriod = useMemo(() => {
    const groups = new Map<Period, DayItem[]>()
    for (const period of PERIODS) groups.set(period.id, [])
    for (const item of rest) groups.get(periodOf(item))!.push(item)
    for (const list of groups.values()) list.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))
    return groups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.items, state.done, state.qty, state.postponed, filter])

  // On load the LIST scrolls so "agora" is in view; the page itself never moves.
  useEffect(() => {
    const list = listRef.current
    const marker = list?.querySelector<HTMLElement>("[data-now]")
    if (!list || !marker) return
    list.scrollTop = Math.max(0, marker.offsetTop - list.clientHeight / 3)
  }, [])

  const rowsFor = (id: string, items: DayItem[], marker: boolean) => {
    const limit = expanded.has(id) ? items.length : MAX_ROWS
    const shown = items.slice(0, limit)
    const nodes: React.ReactNode[] = []
    let placed = !marker
    shown.forEach((item) => {
      if (!placed && item.at && new Date(item.at).getTime() > nowMs) {
        nodes.push(<NowLine key="now" nowIso={data.nowIso} />)
        placed = true
      }
      nodes.push(<DayRow key={item.id} item={item} actions={actions} />)
    })
    // Every item of the section is earlier than now (or the section is empty): the line goes at the end.
    if (!placed && shown.length === items.length) nodes.push(<NowLine key="now" nowIso={data.nowIso} />)
    return (
      <>
        {nodes}
        {items.length > limit ? (
          <Button type="button" variant="ghost" className="h-11 self-start rounded-full px-4" onClick={() => setExpanded((s) => new Set(s).add(id))}>
            Ver mais ({items.length - limit})
          </Button>
        ) : null}
      </>
    )
  }

  const empty = data.items.length === 0

  return (
    <section aria-label="Seu dia" className={cn(bentoCardClass(), "flex min-w-0 flex-col gap-4 rounded-[24px] p-5")}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] leading-6 font-semibold">Seu dia</h2>
        <Link href="/dashboard/agenda" className="rounded-md text-[13px] leading-5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          Abrir agenda
        </Link>
      </header>

      {data.state === "soon" ? (
        <p className="text-[15px] leading-6 text-muted-foreground">Este módulo ainda não tem dados reais. Em breve aparece aqui.</p>
      ) : empty ? (
        <EmptyState
          icon={SquareCheckIcon}
          title="Nada marcado para hoje"
          description="Seu dia está livre. Adicione uma tarefa para começar."
          action={
            <Button variant="outline" className="h-11 rounded-full px-5" onClick={openQuickCapture}>
              <PlusIcon strokeWidth={1.75} /> Adicionar tarefa
            </Button>
          }
          className="py-8"
        />
      ) : (
        <>
          <div role="group" aria-label="Filtrar o dia" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[15px] whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  filter === f.id ? "border-transparent bg-highlight font-medium text-highlight-foreground" : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div ref={listRef} data-testid="seu-dia-list" className="no-scrollbar flex max-h-[min(34rem,68dvh)] flex-col gap-3 overflow-y-auto overscroll-contain">
            {visible.length === 0 ? <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nada deste tipo hoje.</p> : null}

            {overdue.length > 0 ? (
              <Section label="Atrasados" count={overdue.length} collapsible open={overdueOpen} onToggle={() => setOverdueOpen((v) => !v)}>
                {rowsFor("atrasados", overdue, false)}
              </Section>
            ) : null}

            {PERIODS.map((period) => {
              const items = byPeriod.get(period.id) ?? []
              const marker = period.id === nowPeriod
              if (items.length === 0 && !marker) return null
              return (
                <Section key={period.id} label={period.label}>
                  {rowsFor(period.id, items, marker)}
                </Section>
              )
            })}

            {finished.length > 0 ? (
              <Section label="Concluídos" count={finished.length} collapsible open={doneOpen} onToggle={() => setDoneOpen((v) => !v)}>
                {rowsFor("concluidos", finished, false)}
              </Section>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
