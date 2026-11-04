"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRightIcon, CalendarDaysIcon, CalendarIcon, ChevronRightIcon, PlusIcon, SquareCheckIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { showCaptureToast } from "@/components/assistant/capture-toasts"
import { bentoCardClass, cardHover } from "@/components/organizzou/Bento"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { HabitChips } from "@/components/organizzou/HabitChip"
import { NowDivider, TimelineGroup } from "@/components/organizzou/TimelineGroup"
import { TimelineRow, type RowCurrent, type RowHandlers } from "@/components/organizzou/TimelineRow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { captureQuick } from "@/features/assistant/actions"
import { completeTask, updateTask } from "@/features/tasks/actions"
import { completeWorkout, payBill, reopenWorkout, saveHabitQty, undoPayBill } from "@/features/today/actions"
import type { GroupId } from "@/features/today/prefs"
import type { DayData, DayItem, DayItemKind } from "@/features/today/types"
import { toDueIso } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { readAs } from "@/server/assistant/parse"

import { clock, dayKey, dayTitle, hourOf, remainingText, stepFor, TZ } from "./day-format"
import { useTodayPrefs } from "./prefs-context"
import { useTodayState } from "./today-state"

const FILTERS: { id: string; label: string; kinds: DayItemKind[] | null }[] = [
  { id: "tudo", label: "Tudo", kinds: null },
  { id: "tarefas", label: "Tarefas", kinds: ["task"] },
  { id: "agenda", label: "Agenda", kinds: ["event"] },
  { id: "habitos", label: "Hábitos", kinds: ["habit"] },
  { id: "treinos", label: "Treinos", kinds: ["workout"] },
  { id: "financas", label: "Finanças", kinds: ["bill"] },
  { id: "estudos", label: "Estudos", kinds: ["study"] },
]

const EASE = "ease-[cubic-bezier(0.2,0.8,0.2,1)]"
const MAX_DESKTOP = 8
const MAX_MOBILE = 3

/** Keeps "agora", the divider and the overdue wording true while the page stays open: recomputed every minute. */
function useNow(initialIso: string) {
  const [now, setNow] = useState(() => new Date(initialIso).getTime())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const isEnded = (item: DayItem, nowMs: number) => item.kind === "event" && Boolean(item.endAt) && new Date(item.endAt!).getTime() <= nowMs
const isCurrent = (item: DayItem, nowMs: number) => Boolean(item.at && item.endAt) && new Date(item.at!).getTime() <= nowMs && nowMs < new Date(item.endAt!).getTime()

/** Order inside the untimed part of the day: bills, tasks, all-day events, then the rest. */
function rank(item: DayItem) {
  if (item.kind === "bill") return 0
  if (item.kind === "task") return 1
  return 2
}

// ---------------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------------

const DONE_TOAST: Record<DayItemKind, string> = { task: "Tarefa concluída", workout: "Treino concluído", bill: "Conta paga", event: "Concluído", study: "Concluído", habit: "Hábito concluído" }

export function SeuDia({ data }: { data: DayData }) {
  const router = useRouter()
  const state = useTodayState()
  const { prefs, update } = useTodayPrefs()
  const nowMs = useNow(data.nowIso)
  const [filter, setFilter] = useState("tudo")
  const [lingering, setLingering] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Record<string, Partial<DayItem>>>({})
  const [showEarlier, setShowEarlier] = useState(false)
  const [moreOverdue, setMoreOverdue] = useState(false)
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const chipsRef = useRef<HTMLDivElement>(null)
  /** Ids the server gave us when something was created for a tick (a payment's spending, a workout session), so "Desfazer" can remove it. */
  const created = useRef<Record<string, string>>({})
  /** Saves of the same item run one after the other, so a quick "Desfazer" can never overtake the save it undoes. */
  const chain = useRef<Record<string, Promise<unknown>>>({})
  const inOrder = <T,>(id: string, run: () => Promise<T>): Promise<T> => {
    const next = (chain.current[id] ?? Promise.resolve()).then(run, run)
    chain.current[id] = next.catch(() => undefined)
    return next
  }

  const isDone = (item: DayItem) => {
    if (item.habit) return (state.qty[item.id] ?? item.habit.qty) >= item.habit.target
    return state.done[item.id] ?? item.done ?? false
  }
  const qtyOf = (item: DayItem) => state.qty[item.id] ?? item.habit?.qty ?? 0

  // ----- actions ----------------------------------------------------------------------------------------------------
  function complete(item: DayItem, done: boolean) {
    state.setDone(item.id, done)
    if (done) {
      setLingering((s) => new Set(s).add(item.id))
      setTimeout(() => setLingering((s) => (s.delete(item.id), new Set(s))), 1000)
    }
    const planId = item.id.split(":")[0]
    const save = (): Promise<{ ok: boolean }> => {
      if (item.kind === "habit") return saveHabitQty({ habitId: item.id, qty: done ? 1 : 0 })
      if (item.kind === "task") return completeTask({ id: item.id, done })
      if (item.kind === "workout")
        return done ? completeWorkout({ planId }).then((r) => (r.ok && (created.current[item.id] = r.sessionId), r)) : reopenWorkout({ planId, sessionId: created.current[item.id] })
      if (item.kind === "bill")
        return done
          ? payBill({ billId: item.id }).then((r) => (r.ok && (created.current[item.id] = r.transactionId), r))
          : created.current[item.id]
            ? undoPayBill({ billId: item.id, transactionId: created.current[item.id] })
            : Promise.resolve({ ok: false })
      return Promise.resolve({ ok: true })
    }
    void inOrder(item.id, save)
      .then((result) => {
        if (result.ok) return
        throw new Error("save")
      })
      .catch(() => {
        state.setDone(item.id, !done)
        toast.error(item.kind === "bill" && done ? "Não consegui marcar como paga. Confira se você tem uma conta em Finanças." : "Não foi possível salvar. Tente de novo.")
      })
    if (done) toast(DONE_TOAST[item.kind], { action: { label: "Desfazer", onClick: () => complete(item, false) } })
    else toast("Reaberto.")
  }

  function addQty(item: DayItem) {
    if (!item.habit) return
    const before = qtyOf(item)
    const next = Math.min(item.habit.target, Math.round((before + stepFor(item.habit.unit, item.habit.target)) * 100) / 100)
    state.setQty(item.id, next)
    void saveHabitQty({ habitId: item.id, qty: next }).then((result) => {
      if (result.ok) return
      state.setQty(item.id, before)
      toast.error("Não foi possível salvar. Tente de novo.")
    })
    if (next >= item.habit.target) toast.success("Meta do dia atingida.")
  }
  function removeQty(item: DayItem) {
    if (!item.habit) return
    const before = qtyOf(item)
    const next = Math.max(0, Math.round((before - stepFor(item.habit.unit, item.habit.target)) * 100) / 100)
    state.setQty(item.id, next)
    void saveHabitQty({ habitId: item.id, qty: next }).then((result) => {
      if (result.ok) return
      state.setQty(item.id, before)
      toast.error("Não foi possível salvar. Tente de novo.")
    })
  }

  /** Moves a task's due date. `restore` puts the old values back (rollback and "Desfazer"). */
  async function moveTask(item: DayItem, dueAt: string, hasTime: boolean) {
    const result = await inOrder(item.id, () => updateTask({ id: item.id, patch: { dueAt, dueHasTime: hasTime } }))
    return result.ok
  }
  const tomorrowIso = (item: DayItem) => toDueIso(dayKey(nowMs + 86_400_000), item.due?.hasTime ? clock(item.due.at) : null, TZ)

  function postpone1h(item: DayItem) {
    const base = Math.max(nowMs, item.due ? new Date(item.due.at).getTime() : nowMs)
    const moved = new Date(base + 3_600_000).toISOString()
    const original = { at: item.at, overdue: item.overdue, overdueSince: item.overdueSince, due: item.due }
    const apply = (patch: Partial<DayItem>) => setOverrides((o) => ({ ...o, [item.id]: patch }))
    const revert = () => setOverrides((o) => (delete o[item.id], { ...o }))
    apply({ at: moved, overdue: false, overdueSince: undefined, due: { at: moved, hasTime: true } })
    void moveTask(item, moved, true).then((ok) => {
      if (ok) return
      revert()
      toast.error("Não foi possível salvar. Tente de novo.")
    })
    toast("Adiado em 1 hora.", {
      action: {
        label: "Desfazer",
        onClick: () => {
          revert()
          if (original.due) void moveTask(item, original.due.at, original.due.hasTime)
        },
      },
    })
  }

  function tomorrow(item: DayItem) {
    const moved = tomorrowIso(item)
    state.postpone(item.id, true)
    void moveTask(item, moved, Boolean(item.due?.hasTime)).then((ok) => {
      if (ok) return
      state.postpone(item.id, false)
      toast.error("Não foi possível salvar. Tente de novo.")
    })
    toast("Adiado para amanhã.", {
      action: {
        label: "Desfazer",
        onClick: () => {
          state.postpone(item.id, false)
          if (item.due) void moveTask(item, item.due.at, item.due.hasTime)
        },
      },
    })
  }

  function rescheduleOverdue(list: DayItem[]) {
    const tasks = list.filter((item) => item.kind === "task")
    if (tasks.length === 0) return
    tasks.forEach((item) => state.postpone(item.id, true))
    void Promise.all(tasks.map((item) => moveTask(item, tomorrowIso(item), Boolean(item.due?.hasTime)).then((ok) => [item, ok] as const))).then((results) => {
      const failed = results.filter(([, ok]) => !ok).map(([item]) => item)
      failed.forEach((item) => state.postpone(item.id, false))
      if (failed.length > 0) toast.error(`Não consegui reagendar ${plural(failed.length, "tarefa", "tarefas")}.`)
    })
    toast(`${plural(tasks.length, "tarefa reagendada", "tarefas reagendadas")} para amanhã.`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          tasks.forEach((item) => {
            state.postpone(item.id, false)
            if (item.due) void moveTask(item, item.due.at, item.due.hasTime)
          })
        },
      },
    })
  }

  async function quickAdd() {
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    // The same reading the quick capture uses: a date and a time in the text are used when it finds them; otherwise a task due today.
    const now = new Date(nowMs)
    const read = readAs("tarefa", text, now)
    const item = read ? { ...read, day: read.day ?? dayKey(nowMs) } : undefined
    const result = await captureQuick({ text, items: item ? [item] : undefined })
    setAdding(false)
    if (!result.ok) return void toast.error(result.error)
    setDraft("")
    showCaptureToast(result.entries, () => router.refresh())
    router.refresh()
  }

  // ----- what is on the list ----------------------------------------------------------------------------------------
  const items = useMemo(
    () => data.items.filter((item) => !state.postponed.has(item.id)).map((item) => (overrides[item.id] ? { ...item, ...overrides[item.id] } : item)),
    [data.items, state.postponed, overrides]
  )
  const kinds = FILTERS.find((f) => f.id === filter)?.kinds ?? null
  const visible = items.filter((item) => !kinds || kinds.includes(item.kind))
  const stays = (item: DayItem) => !isDone(item) || lingering.has(item.id)

  const habits = visible.filter((item) => item.kind === "habit")
  const overdue = visible.filter((item) => item.kind !== "habit" && item.overdue && stays(item)).sort((a, b) => new Date(a.overdueSince ?? 0).getTime() - new Date(b.overdueSince ?? 0).getTime())
  const finished = visible.filter((item) => item.kind !== "habit" && isDone(item) && !lingering.has(item.id)).sort((a, b) => (state.doneAt[b.id] ?? b.doneAtMs ?? 0) - (state.doneAt[a.id] ?? a.doneAtMs ?? 0))
  const today = visible.filter((item) => item.kind !== "habit" && !item.overdue && stays(item))
  const earlier = today.filter((item) => isEnded(item, nowMs)).sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime())
  const rest = today.filter((item) => !isEnded(item, nowMs))
  const timed = rest.filter((item) => item.at).sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime())
  const untimed = rest.filter((item) => !item.at).sort((a, b) => rank(a) - rank(b))
  const past = timed.filter((item) => new Date(item.at!).getTime() <= nowMs && !isCurrent(item, nowMs))
  const now = timed.filter((item) => isCurrent(item, nowMs))
  const future = timed.filter((item) => new Date(item.at!).getTime() > nowMs)
  const tomorrowItems = (data.tomorrow ?? []).filter((item) => !kinds || kinds.includes(item.kind))

  // ----- header numbers (never filtered by a chip): past calendar events do not count -----------------------------
  const counted = items.filter((item) => !isEnded(item, nowMs))
  const doneCount = counted.filter(isDone).length
  const overdueCount = items.filter((item) => item.kind !== "habit" && item.overdue && !isDone(item)).length
  const pct = counted.length === 0 ? undefined : Math.round((doneCount / counted.length) * 100)
  const pendingCount = (list: DayItem[]) => list.filter((item) => !isDone(item) && !isEnded(item, nowMs)).length
  const chips = FILTERS.map((f) => ({ ...f, count: pendingCount(f.kinds ? items.filter((item) => f.kinds!.includes(item.kind)) : items) })).filter((f) => f.id === "tudo" || f.count > 0 || f.id === filter)

  // On phones the chips are one scrolling row: the active one is brought into view.
  useEffect(() => {
    const row = chipsRef.current
    const active = row?.querySelector<HTMLElement>("[aria-pressed=true]")
    if (!row || !active) return
    const left = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2
    row.scrollTo({ left: Math.max(0, left), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }, [filter])

  // ----- group state: the person's choice if any, otherwise a default (Atrasados, Hoje and Hábitos open) ---------------
  const isOpen = (id: GroupId) => {
    const choice = prefs.collapsedGroups[id]
    if (id === "atrasados") {
      // Folded only while no NEW overdue item has appeared since it was folded.
      const known = overdue.every((item) => prefs.overdueSeen.includes(item.id))
      return !(choice === true && known)
    }
    if (choice !== undefined) return !choice
    return id !== "concluidos" && id !== "amanha"
  }
  const toggle = (id: GroupId) => {
    const open = isOpen(id)
    update(
      (p) => ({ ...p, collapsedGroups: { ...p.collapsedGroups, [id]: open }, overdueSeen: id === "atrasados" && open ? overdue.map((item) => item.id).slice(0, 100) : p.overdueSeen }),
      { silent: true }
    )
  }

  // ----- rows ---------------------------------------------------------------------------------------------------------
  const handlersFor = (item: DayItem): RowHandlers => {
    const canTick = item.kind === "task" || (item.kind === "workout" && item.action === "check") || item.kind === "bill"
    const done = isDone(item)
    return {
      toggle: canTick ? (checked) => complete(item, checked) : undefined,
      postpone1h: item.kind === "task" && !done ? () => postpone1h(item) : undefined,
      tomorrow: item.kind === "task" && !done ? () => tomorrow(item) : undefined,
      pay: item.kind === "bill" && !done ? () => complete(item, true) : undefined,
    }
  }
  const currentOf = (item: DayItem): RowCurrent => {
    const start = new Date(item.at!).getTime()
    const end = new Date(item.endAt!).getTime()
    return { endsAt: clock(end), remaining: remainingText(end - nowMs), pct: ((nowMs - start) / (end - start)) * 100, range: `${clock(start)}–${clock(end)}` }
  }
  const row = (item: DayItem, extra?: { current?: boolean; dimmed?: boolean; className?: string }) => (
    <TimelineRow key={item.id} item={item} done={isDone(item)} nowMs={nowMs} handlers={handlersFor(item)} current={extra?.current ? currentOf(item) : undefined} dimmed={extra?.dimmed} className={extra?.className} />
  )

  const overdueRows = (
    <>
      {overdue.map((item, index) =>
        row(item, { className: !moreOverdue && index >= MAX_DESKTOP ? "hidden" : !moreOverdue && index >= MAX_MOBILE ? "max-md:hidden" : undefined })
      )}
      {!moreOverdue && overdue.length > MAX_MOBILE ? (
        <Button type="button" variant="ghost" className="h-11 self-start rounded-full px-4 md:hidden" onClick={() => setMoreOverdue(true)}>
          Ver mais {overdue.length - MAX_MOBILE} atrasados
        </Button>
      ) : null}
      {!moreOverdue && overdue.length > MAX_DESKTOP ? (
        <Button type="button" variant="ghost" className="hidden h-11 self-start rounded-full px-4 md:inline-flex" onClick={() => setMoreOverdue(true)}>
          Ver mais ({overdue.length - MAX_DESKTOP})
        </Button>
      ) : null}
    </>
  )

  const empty = data.items.length === 0
  const habitDone = habits.filter((item) => isDone(item)).length

  const quickAddForm = (
    <form
      className="hidden md:block"
      onSubmit={(event) => {
        event.preventDefault()
        void quickAdd()
      }}
    >
      <label htmlFor="seu-dia-quick-add" className="sr-only">
        Adicionar ao dia
      </label>
      <div className="relative">
        <PlusIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="seu-dia-quick-add"
          value={draft}
          disabled={adding}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Adicionar ao dia — ex.: “ligar para o banco às 10h”"
          autoComplete="off"
          className="h-12 rounded-2xl pl-12 text-[15px] md:h-12"
        />
      </div>
    </form>
  )

  return (
    <section aria-label="Seu dia" className={cn(bentoCardClass(), "flex min-w-0 flex-col gap-4 rounded-[24px] p-5")}>
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex items-start justify-between gap-3 md:block">
          <div className="flex min-w-0 flex-col">
            <h3 className="text-[16px] leading-6 font-semibold">{dayTitle(nowMs)}</h3>
          </div>
          <Button asChild variant="outline" size="icon" className="size-11 shrink-0 rounded-full md:hidden">
            <Link href="/dashboard/agenda" aria-label="Abrir agenda">
              <CalendarIcon strokeWidth={1.75} />
            </Link>
          </Button>
        </div>
        <div className="flex items-start gap-3 md:ml-auto">
          {data.state === "ok" && !empty ? (
            <div className="flex w-full flex-col gap-2 md:w-[220px]" data-testid="seu-dia-summary">
              <div className="flex items-center justify-between gap-3 text-[13px] leading-5">
                <span className="tabular font-semibold">
                  {doneCount} de {counted.length} feitos
                </span>
                {overdueCount > 0 ? (
                  <span className="tabular inline-flex items-center gap-1 text-muted-foreground">
                    <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
                    {plural(overdueCount, "atrasado", "atrasados")}
                  </span>
                ) : null}
              </div>
              {pct !== undefined ? (
                <div role="progressbar" aria-label={`Dia: ${pct}% concluído`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full bg-chart-1 transition-[width] duration-[400ms] motion-reduce:transition-none", EASE)} style={{ width: `${pct}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
          <Button asChild variant="ghost" className="hidden h-10 shrink-0 gap-1.5 rounded-full px-3 text-[14px] md:inline-flex md:h-10">
            <Link href="/dashboard/agenda">
              Agenda <ArrowUpRightIcon strokeWidth={1.75} className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {data.state === "soon" ? (
        <p className="text-[15px] leading-6 text-muted-foreground">Este módulo ainda não tem dados reais. Em breve aparece aqui.</p>
      ) : empty ? (
        <>
          <EmptyState icon={SquareCheckIcon} title="Nada marcado para hoje" description="Seu dia está livre. Adicione algo abaixo ou use o botão Novo." className="py-8" />
          {quickAddForm}
        </>
      ) : (
        <>
          <div ref={chipsRef} role="group" aria-label="Filtrar o dia" className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 max-md:[mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-28px),transparent)]">
            {chips.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex h-11 shrink-0 snap-center items-center gap-2 rounded-full border px-4 text-[15px] whitespace-nowrap outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none md:h-9 md:text-[14px]",
                  EASE,
                  filter === f.id ? "border-transparent bg-highlight font-medium text-highlight-foreground" : "border-border text-foreground hover:bg-accent"
                )}
              >
                {f.label}
                <span className={cn("tabular text-[13px]", filter === f.id ? "opacity-70" : "text-muted-foreground")}>{f.count}</span>
              </button>
            ))}
          </div>

          <div data-testid="seu-dia-list" className="flex flex-col gap-1">
            {visible.length === 0 && tomorrowItems.length === 0 ? <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nada deste tipo hoje.</p> : null}

            {overdue.length > 0 ? (
              <TimelineGroup
                id="atrasados"
                label="Atrasados"
                count={overdue.length}
                open={isOpen("atrasados")}
                onToggle={() => toggle("atrasados")}
                action={
                  overdue.some((item) => item.kind === "task") ? (
                    <Button type="button" variant="outline" className="hidden h-9 shrink-0 gap-2 rounded-full px-4 text-[13px] md:inline-flex" onClick={() => rescheduleOverdue(overdue)}>
                      <CalendarIcon strokeWidth={1.75} className="size-4" />
                      Reagendar tudo para amanhã
                    </Button>
                  ) : null
                }
              >
                {/* Phones: the bulk action lives inside the expanded group, as a full-width button, so it never crowds the header. */}
                {overdue.some((item) => item.kind === "task") ? (
                  <Button type="button" variant="secondary" className="mb-1 h-11 w-full gap-2 rounded-full md:hidden" onClick={() => rescheduleOverdue(overdue)}>
                    <CalendarIcon strokeWidth={1.75} className="size-4" />
                    Reagendar tudo para amanhã
                  </Button>
                ) : null}
                {overdueRows}
              </TimelineGroup>
            ) : null}

            {today.length > 0 ? (
              <TimelineGroup id="hoje" label="Hoje" count={rest.length} open={isOpen("hoje")} onToggle={() => toggle("hoje")}>
                {earlier.length > 0 ? (
                  <div className="flex flex-col">
                    <button type="button" aria-expanded={showEarlier} onClick={() => setShowEarlier((v) => !v)} className={cn("-mx-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-left", cardHover)}>
                      <ChevronRightIcon aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0 transition-transform duration-[400ms] motion-reduce:transition-none", EASE, showEarlier && "rotate-90")} />
                      <span className="min-w-0 truncate text-[13px] leading-5 text-muted-foreground">
                        Mais cedo · {plural(earlier.length, "evento", "eventos")}
                      </span>
                    </button>
                    {showEarlier ? earlier.map((item) => row(item, { dimmed: true })) : null}
                  </div>
                ) : null}
                {past.map((item) => row(item))}
                <NowDivider nowMs={nowMs} />
                {now.map((item) => row(item, { current: true }))}
                {future.map((item) => row(item))}
                {untimed.map((item) => row(item))}
              </TimelineGroup>
            ) : null}

            {habits.length > 0 ? (
              <TimelineGroup id="habitos" label="Hábitos" count={`${habitDone} de ${habits.length}`} open={isOpen("habitos")} onToggle={() => toggle("habitos")}>
                <HabitChips habits={habits} actions={{ toggle: (item) => complete(item, !isDone(item)), add: addQty, remove: removeQty, qtyOf, isDone }} />
              </TimelineGroup>
            ) : null}

            {finished.length > 0 ? (
              <TimelineGroup id="concluidos" label="Concluídos" count={finished.length} open={isOpen("concluidos")} onToggle={() => toggle("concluidos")}>
                {finished.map((item) => row(item))}
              </TimelineGroup>
            ) : null}

            {hourOf(nowMs) >= 18 && tomorrowItems.length > 0 ? (
              <TimelineGroup
                id="amanha"
                label="Amanhã"
                count={tomorrowItems.length}
                icon={CalendarDaysIcon}
                open={isOpen("amanha")}
                onToggle={() => toggle("amanha")}
              >
                {tomorrowItems.map((item) => (
                  <TimelineRow key={item.id} item={item} done={false} nowMs={nowMs} />
                ))}
              </TimelineGroup>
            ) : null}
          </div>
          {quickAddForm}
        </>
      )}
    </section>
  )
}
