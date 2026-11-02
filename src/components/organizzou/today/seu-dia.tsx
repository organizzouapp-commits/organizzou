"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChevronDownIcon,
  DumbbellIcon,
  FlagIcon,
  FlameIcon,
  GraduationCapIcon,
  PlusIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SquareCheckIcon,
  TimerResetIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAssistant } from "@/components/assistant/assistant-context"
import { bentoCardClass, cardHover } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { SwipeRow } from "@/components/organizzou/SwipeRow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { saveHabitQty } from "@/features/today/actions"
import { completeTask, updateTask } from "@/features/tasks/actions"
import type { GroupId } from "@/features/today/prefs"
import type { DayData, DayItem, DayItemKind } from "@/features/today/types"
import { cn } from "@/lib/utils"

import { useTodayPrefs } from "./prefs-context"
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

type Period = "manha" | "tarde" | "noite"
const PERIODS: { id: Period; label: string }[] = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
  { id: "noite", label: "Noite" },
]

const hourOf = (ms: number) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(ms))) % 24
const clock = (iso: string | number) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
const periodOfHour = (hour: number): Period => (hour < 12 ? "manha" : hour < 18 ? "tarde" : "noite")

/** Step of the "+" button for a quantity habit: a natural amount per unit, never a fraction of the target. */
function stepFor(unit: string, target: number) {
  if (unit === "L") return 0.25
  if (unit === "min") return 10
  if (unit === "páginas") return 5
  return Math.max(1, Math.round(target / 4))
}
const number = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
const durationText = (min?: number) => (min ? (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""}` : `${min} min`) : null)

/** "em 25 min", "em 1 h 20". */
function inText(minutes: number) {
  if (minutes < 1) return "agora"
  if (minutes < 60) return `em ${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `em ${h} h${m ? ` ${m}` : ""}`
}

/** "há 2 dias", "há 3 h", "há 20 min". */
function agoText(sinceMs: number, nowMs: number) {
  const minutes = Math.max(1, Math.round((nowMs - sinceMs) / 60000))
  if (minutes < 60) return `há ${minutes} min`
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`
  const days = Math.floor(minutes / (24 * 60))
  return `há ${days} ${days === 1 ? "dia" : "dias"}`
}

/** Keeps "agora" and "em 25 min" true while the page stays open. */
function useNow(initialIso: string) {
  const [now, setNow] = useState(() => new Date(initialIso).getTime())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// ---------------------------------------------------------------------------------------------------------------------

type RowActions = {
  isDone: (item: DayItem) => boolean
  qtyOf: (item: DayItem) => number
  complete: (item: DayItem, done: boolean) => void
  addQty: (item: DayItem) => void
  postpone: (item: DayItem) => void
}

type Mark = "now" | "next" | null

function ItemBadges({ item, mark, nowMs, nextAtMs }: { item: DayItem; mark: Mark; nowMs: number; nextAtMs?: number }) {
  return (
    <>
      {mark === "now" ? <Badge variant="highlight" className="rounded-full whitespace-nowrap">Agora</Badge> : null}
      {mark === "next" && nextAtMs ? (
        <Badge variant="secondary" className="rounded-full whitespace-nowrap">
          Próximo · {inText((nextAtMs - nowMs) / 60000)}
        </Badge>
      ) : null}
      {item.bill ? (
        <Badge variant="outline" className="rounded-full whitespace-nowrap">
          {item.bill.when}
        </Badge>
      ) : null}
    </>
  )
}

function DayRow({ item, actions, mark, nowMs, nextAtMs, timeColumn }: { item: DayItem; actions: RowActions; mark: Mark; nowMs: number; nextAtMs?: number; timeColumn: boolean }) {
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

  const [moduleLabel, ...detailParts] = item.meta.split(" · ")
  const detail = detailParts.join(" · ")
  const qty = item.habit ? actions.qtyOf(item) : 0
  const duration = durationText(item.durationMin)
  const late = item.overdueSince ? agoText(new Date(item.overdueSince).getTime(), nowMs) : null

  const row = (
    <div
      data-kind={item.kind}
      data-done={done ? "" : undefined}
      data-mark={mark ?? undefined}
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={(event) => {
        if (!canComplete && !canPostpone) return
        event.preventDefault()
        setMenu(true)
      }}
      className={cn(
        "relative flex min-h-16 items-center gap-3 py-3 min-[431px]:min-h-14",
        // A section without times reserves no time column: the icon (or title, on phones) starts at the left edge, level with the group label.
        timeColumn || mark ? "pl-3" : "pl-0",
        // The hairline starts under the title, not at the card edge.
        timeColumn ? "after:absolute after:right-0 after:bottom-0 after:left-[72px] after:h-px after:bg-border min-[431px]:after:left-[116px]" : "after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-border min-[431px]:after:left-6",
        // The next item gets a Lima bar (Tinta in light mode: `primary`), never a color of its own.
        mark === "next" && "before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary",
        mark === "now" && "before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary"
      )}
    >
      {timeColumn ? (
        <span className="flex w-12 shrink-0 flex-col min-[431px]:w-16">
          {item.at ? <span className="tabular text-[14px] leading-5 font-semibold">{clock(item.at)}</span> : null}
          {duration ? <span className="tabular text-[12px] leading-4 text-muted-foreground">{duration}</span> : null}
        </span>
      ) : null}
      <Icon aria-hidden strokeWidth={1.75} className={cn("hidden size-4 shrink-0 text-muted-foreground min-[431px]:block", !timeColumn && "-mr-1")} />

      <Link href={item.href} className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className={cn("line-clamp-2 text-[15px] leading-5 font-medium break-words", done && "text-muted-foreground line-through")}>
          {item.priority === "high" ? (
            <>
              <FlagIcon aria-hidden strokeWidth={1.75} className="mr-1 -mt-0.5 inline size-3.5" />
              <span className="sr-only">Prioridade alta. </span>
            </>
          ) : null}
          {item.title}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
          <Icon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0 min-[431px]:hidden" />
          <span className="shrink-0">{moduleLabel}</span>
          {detail ? <span className="min-w-0 truncate">· {detail}</span> : null}
          {late ? <span className="shrink-0 font-medium text-foreground">· {late}</span> : null}
          {item.streak ? (
            <span className="tabular flex shrink-0 items-center gap-0.5">
              · <FlameIcon aria-hidden strokeWidth={1.75} className="size-3.5" /> {item.streak} dias
            </span>
          ) : null}
          {item.habit ? (
            <span className="tabular shrink-0">
              · {number(qty)} de {number(item.habit.target)} {item.habit.unit}
            </span>
          ) : null}
        </span>
        {item.habit ? <Progress value={Math.min(100, Math.round((qty / item.habit.target) * 100))} aria-hidden className="mt-1 h-1 max-w-48" /> : null}
        {item.bill ? (
          <span className="tabular text-[13px] leading-5 font-medium min-[431px]:hidden">{item.bill.amount}</span>
        ) : null}
        <span className="flex flex-wrap gap-1.5 pt-0.5 empty:hidden min-[431px]:hidden">
          <ItemBadges item={item} mark={mark} nowMs={nowMs} nextAtMs={nextAtMs} />
        </span>
      </Link>

      <span className="hidden shrink-0 items-center gap-2 min-[431px]:flex">
        <ItemBadges item={item} mark={mark} nowMs={nowMs} nextAtMs={nextAtMs} />
        {item.bill ? <span className="tabular min-w-20 text-right text-[15px] font-medium">{item.bill.amount}</span> : null}
      </span>

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
          <DropdownMenuContent align="end" collisionPadding={{ top: 16, bottom: 104, left: 16, right: 16 }} className="min-w-52 rounded-2xl p-2">
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

function NowLine({ nowMs }: { nowMs: number }) {
  return (
    <div role="separator" aria-label={`Agora, ${clock(nowMs)}`} data-now className="flex items-center gap-3 py-1 pl-3">
      <span className="tabular w-12 shrink-0 rounded-full bg-highlight px-2 py-0.5 text-center text-[11px] leading-4 font-semibold text-highlight-foreground min-[431px]:w-16">agora</span>
      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-primary" />
    </div>
  )
}

/** A group of the day. The WHOLE header is the toggle: chevron next to the label, then the count, then (folded) a short summary. */
function Group({ id, label, count, open, onToggle, summary, emphasis, children }: { id: GroupId; label: string; count: number; open: boolean; onToggle: () => void; summary: string; emphasis?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={label} data-group={id} className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn("-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-xl px-2 text-left", cardHover)}
      >
        <ChevronDownIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none", !open && "-rotate-90")} />
        {emphasis ? <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" /> : null}
        <h3 className={cn("text-[11px] leading-4 font-semibold tracking-[0.12em] uppercase", emphasis ? "text-foreground" : "text-muted-foreground")}>{label}</h3>
        <Badge variant="secondary" className="tabular rounded-full">
          {count}
        </Badge>
        {!open ? <span className="min-w-0 truncate text-[13px] leading-5 text-muted-foreground">{summary}</span> : null}
      </button>
      {open ? children : null}
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function SeuDia({ data }: { data: DayData }) {
  const state = useTodayState()
  const { prefs, update } = useTodayPrefs()
  const { openQuickCapture } = useAssistant()
  const nowMs = useNow(data.nowIso)
  const [filter, setFilter] = useState("tudo")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)

  const isDone = (item: DayItem) => {
    if (item.habit) return (state.qty[item.id] ?? item.habit.qty) >= item.habit.target
    return state.done[item.id] ?? item.done ?? false
  }
  const qtyOf = (item: DayItem) => state.qty[item.id] ?? item.habit?.qty ?? 0

  async function persistTask(item: DayItem, run: () => Promise<{ ok: boolean }>, rollback: () => void) {
    // Tasks go to the task actions, habits to the habit log; the other kinds (events, bills) are only listed here.
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
      if (item.kind === "habit") {
        void saveHabitQty({ habitId: item.id, qty: done ? 1 : 0 }).then((result) => {
          if (result.ok) return
          state.setDone(item.id, !done)
          toast.error("Não foi possível salvar. Tente de novo.")
        })
      }
      void persistTask(
        item,
        () => (completeTask({ id: item.id, done })),
        () => state.setDone(item.id, !done)
      )
      toast(done ? "Concluído." : "Reaberto.", done ? { action: { label: "Desfazer", onClick: () => actions.complete(item, false) } } : undefined)
    },
    addQty(item) {
      if (!item.habit) return
      const next = Math.min(item.habit.target, Math.round((qtyOf(item) + stepFor(item.habit.unit, item.habit.target)) * 100) / 100)
      const before = qtyOf(item)
      state.setQty(item.id, next)
      void saveHabitQty({ habitId: item.id, qty: next }).then((result) => {
        if (result.ok) return
        state.setQty(item.id, before)
        toast.error("Não foi possível salvar. Tente de novo.")
      })
      if (next >= item.habit.target) toast.success("Meta do dia atingida.")
    },
    postpone(item) {
      if (!item.due) return
      const moved = new Date(new Date(item.due.at).getTime() + 24 * 60 * 60_000).toISOString()
      state.postpone(item.id, true)
      void persistTask(
        item,
        () => (updateTask({ id: item.id, patch: { dueAt: moved, dueHasTime: item.due!.hasTime } })),
        () => state.postpone(item.id, false)
      )
      toast("Adiado para amanhã.", {
        action: {
          label: "Desfazer",
          onClick: () => {
            state.postpone(item.id, false)
            void persistTask(
              item,
              () => (updateTask({ id: item.id, patch: { dueAt: item.due!.at, dueHasTime: item.due!.hasTime } })),
              () => state.postpone(item.id, true)
            )
          },
        },
      })
    },
  }

  // ----- what is on the list --------------------------------------------------------------------------------------
  const all = data.items.filter((item) => !state.postponed.has(item.id))
  const kinds = FILTERS.find((f) => f.id === filter)?.kinds ?? null
  const shown = all.filter((item) => !kinds || kinds.includes(item.kind))
  const pendingAll = all.filter((item) => !isDone(item))
  const doneAll = all.filter(isDone)
  const overdueAll = pendingAll.filter((item) => item.overdue)

  const finished = shown.filter(isDone).sort((a, b) => (state.doneAt[b.id] ?? b.doneAtMs ?? 0) - (state.doneAt[a.id] ?? a.doneAtMs ?? 0))
  const pending = shown.filter((item) => !isDone(item))
  const overdue = pending.filter((item) => item.overdue).sort((a, b) => new Date(a.overdueSince ?? 0).getTime() - new Date(b.overdueSince ?? 0).getTime())
  const rest = pending.filter((item) => !item.overdue)

  const timed = rest.filter((item) => item.at).sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime())
  const byPeriod = (period: Period) => timed.filter((item) => periodOfHour(hourOf(new Date(item.at!).getTime())) === period)
  const untimed = rest
    .filter((item) => !item.at)
    .sort((a, b) => rank(a) - rank(b) || prio(b) - prio(a))

  // The next item that has not started, and what is happening right now.
  const nextItem = timed.find((item) => new Date(item.at!).getTime() > nowMs)
  const markOf = (item: DayItem): Mark => {
    if (item.at && item.endAt && new Date(item.at).getTime() <= nowMs && nowMs < new Date(item.endAt).getTime()) return "now"
    return nextItem?.id === item.id ? "next" : null
  }

  // ----- counts for the header and the chips -----------------------------------------------------------------------
  const total = pendingAll.length + doneAll.length
  const summary = [plural(pendingAll.length, "pendente", "pendentes"), doneAll.length ? plural(doneAll.length, "concluído", "concluídos") : null, overdueAll.length ? plural(overdueAll.length, "atrasado", "atrasados") : null].filter(Boolean).join(" · ")
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.kinds ? all.filter((item) => f.kinds!.includes(item.kind)).length : all.length]))
  const chips = FILTERS.filter((f) => f.id === "tudo" || counts[f.id] > 0 || f.id === filter)

  // ----- group state: the person's choice if any, otherwise a smart default ----------------------------------------
  const isOpen = (id: GroupId) => {
    const choice = prefs.collapsedGroups[id]
    if (id === "atrasados") {
      // Folded only while no NEW overdue item has appeared since it was folded.
      const known = overdueAll.every((item) => prefs.overdueSeen.includes(item.id))
      return !(choice === true && known)
    }
    if (choice !== undefined) return !choice
    return id !== "concluidos"
  }
  const toggle = (id: GroupId, currentlyOpen: boolean) =>
    update((p) => ({
      ...p,
      collapsedGroups: { ...p.collapsedGroups, [id]: currentlyOpen },
      overdueSeen: id === "atrasados" && currentlyOpen ? overdueAll.map((item) => item.id).slice(0, 100) : p.overdueSeen,
    }), { silent: true })

  // On load the LIST scrolls so "agora" is in view; the page itself never moves.
  useEffect(() => {
    const list = listRef.current
    const marker = list?.querySelector<HTMLElement>("[data-now]")
    if (!list || !marker) return
    // Scroll only as far as needed to reveal the line: the emphasized "Atrasados" group at the top stays in view when it fits.
    const bottom = marker.offsetTop + marker.offsetHeight + 72
    list.scrollTop = Math.max(0, bottom - list.clientHeight)
  }, [])

  const nowPeriod = periodOfHour(hourOf(nowMs))

  const rows = (id: string, items: DayItem[], withNowLine: boolean) => {
    const timeColumn = items.some((item) => item.at)
    const limit = expanded.has(id) ? items.length : MAX_ROWS
    const shownRows = items.slice(0, limit)
    const nodes: React.ReactNode[] = []
    let placed = !withNowLine
    shownRows.forEach((item) => {
      if (!placed && item.at && new Date(item.at).getTime() > nowMs) {
        nodes.push(<NowLine key="now" nowMs={nowMs} />)
        placed = true
      }
      nodes.push(<DayRow key={item.id} item={item} timeColumn={timeColumn} actions={actions} mark={markOf(item)} nowMs={nowMs} nextAtMs={nextItem?.at ? new Date(nextItem.at).getTime() : undefined} />)
    })
    // Every item of the period is earlier than now (or there is none): the line goes at the end.
    if (!placed && shownRows.length === items.length) nodes.push(<NowLine key="now" nowMs={nowMs} />)
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
  const pct = total === 0 ? undefined : Math.round((doneAll.length / total) * 100)

  return (
    <section aria-label="Seu dia" className={cn(bentoCardClass(), "flex min-w-0 flex-col gap-4 rounded-[24px] p-5")}>
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-[17px] leading-6 font-semibold">Seu dia</h2>
            {data.state === "ok" && !empty ? (
              <p className="tabular text-[13px] leading-5 text-muted-foreground" data-testid="seu-dia-summary">
                {summary}
              </p>
            ) : null}
          </div>
          <Button asChild size="sm" className="h-11 shrink-0 gap-2 rounded-xl bg-highlight px-3.5 text-[14px] text-highlight-foreground hover:bg-highlight/85 md:h-9">
            <Link href="/dashboard/agenda">
              <CalendarIcon strokeWidth={1.75} className="size-4" />
              Abrir agenda
              <ArrowUpRightIcon strokeWidth={1.75} className="size-3.5" />
            </Link>
          </Button>
        </div>
        {/* No bar when there is nothing to do: 0 of 0 is never 100%. */}
        {pct !== undefined ? <Progress value={pct} aria-label={`Dia: ${pct}% concluído`} className="h-1.5" /> : null}
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
          {/* Scrolls sideways; on phones the edges fade so it is clear there is more. */}
          <div role="group" aria-label="Filtrar o dia" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 max-md:[mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-28px),transparent)]">
            {chips.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] whitespace-nowrap outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  filter === f.id ? "border-transparent bg-highlight font-medium text-highlight-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {f.label}
                <span className="tabular text-[13px] opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <div ref={listRef} data-testid="seu-dia-list" className="flex flex-col gap-1">
            {shown.length === 0 ? <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nada deste tipo hoje.</p> : null}

            {overdue.length > 0 ? (
              <Group id="atrasados" label="Atrasados" count={overdue.length} open={isOpen("atrasados")} onToggle={() => toggle("atrasados", isOpen("atrasados"))} summary={plural(overdue.length, "pendente", "pendentes")} emphasis>
                {rows("atrasados", overdue, false)}
              </Group>
            ) : null}

            {PERIODS.map((period) => {
              const items = byPeriod(period.id)
              const hasNow = period.id === nowPeriod
              if (items.length === 0 && !hasNow) return null
              const id = period.id as GroupId
              return (
                <Group key={period.id} id={id} label={period.label} count={items.length} open={isOpen(id)} onToggle={() => toggle(id, isOpen(id))} summary={plural(items.length, "pendente", "pendentes")}>
                  {rows(period.id, items, hasNow)}
                </Group>
              )
            })}

            {untimed.length > 0 ? (
              <Group id="sem-horario" label="Sem horário" count={untimed.length} open={isOpen("sem-horario")} onToggle={() => toggle("sem-horario", isOpen("sem-horario"))} summary={plural(untimed.length, "pendente", "pendentes")}>
                {rows("sem-horario", untimed, false)}
              </Group>
            ) : null}

            {finished.length > 0 ? (
              <Group id="concluidos" label="Concluídos" count={finished.length} open={isOpen("concluidos")} onToggle={() => toggle("concluidos", isOpen("concluidos"))} summary={plural(finished.length, "concluído", "concluídos")}>
                {rows("concluidos", finished, false)}
              </Group>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

/** Order inside "Sem horário": bills, tasks, all-day events, plain habits, and quantity habits (with progress) last. */
function rank(item: DayItem) {
  if (item.kind === "bill") return 0
  if (item.kind === "task") return 1
  if (item.kind === "habit") return item.habit ? 4 : 3
  return 2
}
const prio = (item: DayItem) => ({ high: 3, medium: 2, low: 1, none: 0 })[item.priority ?? "none"]
