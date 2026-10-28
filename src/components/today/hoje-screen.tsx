"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AnnoyedIcon,
  DumbbellIcon,
  FrownIcon,
  GlassWaterIcon,
  GraduationCapIcon,
  LaughIcon,
  MehIcon,
  CalendarDaysIcon,
  PlusIcon,
  SmileIcon,
  SparklesIcon,
  SquareCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAssistant } from "@/components/assistant/assistant-context"
import { BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { StatRow } from "@/components/organizzou/layout"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { HabitCheck } from "@/components/organizzou/HabitCheck"
import { SectionTitle } from "@/components/organizzou/PageHeader"
import { Stat } from "@/components/organizzou/Stat"
import { DueLabel, PriorityIcon } from "@/components/tasks/task-meta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { expandEvent } from "@/features/calendar/recurrence"
import { billStatus, monthOf, spendByCategory, totals } from "@/features/finance/stats"
import { dayTotals } from "@/features/diet/stats"
import { isDone, isScheduled } from "@/features/habits/stats"
import { MOOD_LABELS, type Mood } from "@/features/journal/types"
import { daysUntil, isDue } from "@/features/studies/spaced-repetition"
import { dayDiff, formatDue, inTz, isOverdue } from "@/lib/dates"
import { formatBRL } from "@/lib/money"
import { cn } from "@/lib/utils"
import { buildMockEvents } from "@/mocks/calendar"
import { buildMockDeadlines, buildMockCards, buildMockSessions, mockSubjects } from "@/mocks/studies"
import { buildMockBills, buildMockTransactions, mockCategories } from "@/mocks/finance"
import { buildMockHabitLogs, mockHabits } from "@/mocks/habits"
import { buildMockMealItems, mockDietGoal, mockFoods } from "@/mocks/diet"
import { mockStudySlots, mockWorkoutSlots } from "@/mocks/schedule"
import { createMockBoardApi, getMockBoardsStore } from "@/mocks/tasks-api"
import { at, dayOf, MOCK_TIMEZONE } from "@/mocks/time"
import type { TaskView } from "@/features/tasks/types"

const MOODS: { value: Mood; icon: LucideIcon }[] = [
  { value: 1, icon: FrownIcon },
  { value: 2, icon: AnnoyedIcon },
  { value: 3, icon: MehIcon },
  { value: 4, icon: SmileIcon },
  { value: 5, icon: LaughIcon },
]

function formatTime(date: Date) {
  const local = inTz(date, MOCK_TIMEZONE)
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
}

export function HojeScreen({ nowIso }: { nowIso: string }) {
  const now = new Date(nowIso)
  const today = dayOf(nowIso)
  const { openAssistant, openQuickCapture } = useAssistant()

  // --------------------------------------------------------------- tasks
  const store = getMockBoardsStore(nowIso)
  const allTasks: (TaskView & { boardName: string; boardId: string })[] = store.boards.flatMap((b) =>
    b.tasks.map((t) => ({ ...t, boardName: b.board.name, boardId: b.board.id }))
  )
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const open = allTasks.filter((t) => !t.completed_at)
  const overdue = open.filter((t) => isOverdue(t, now, MOCK_TIMEZONE))
  const dueToday = open.filter((t) => t.due_at && dayDiff(t.due_at, now, MOCK_TIMEZONE) === 0 && !overdue.includes(t))
  const focus = [...overdue, ...dueToday]
  const doneBefore = allTasks.filter((t) => t.completed_at && dayDiff(t.completed_at, now, MOCK_TIMEZONE) === 0).length
  const doneToday = doneBefore + completed.size
  const pendingCount = focus.filter((t) => !completed.has(t.id)).length
  const planned = focus.length + doneBefore
  const progress = planned === 0 ? 0 : Math.round((doneToday / planned) * 100)

  async function toggleTask(task: TaskView) {
    const next = !completed.has(task.id)
    setCompleted((current) => {
      const copy = new Set(current)
      if (next) copy.add(task.id)
      else copy.delete(task.id)
      return copy
    })
    await createMockBoardApi(nowIso).completeTask({ id: task.id, done: next })
    toast(next ? "Tarefa concluída." : "Tarefa reaberta.")
  }

  // -------------------------------------------------------------- agenda
  const from = new Date(at(nowIso, 0, "00:00"))
  const to = new Date(at(nowIso, 1, "00:00"))
  const agenda = [
    ...buildMockEvents(nowIso).flatMap((e) => expandEvent(e, from, to, MOCK_TIMEZONE)).map((i) => ({ key: i.key, title: i.title, start: i.start, allDay: i.allDay, kind: "event" as const, detail: i.detail })),
    ...mockWorkoutSlots(nowIso).filter((s) => new Date(s.start) >= from && new Date(s.start) < to).map((s) => ({ key: s.id, title: s.title, start: new Date(s.start), allDay: false, kind: "workout" as const, detail: s.detail })),
    ...mockStudySlots(nowIso).filter((s) => new Date(s.start) >= from && new Date(s.start) < to).map((s) => ({ key: s.id, title: s.title, start: new Date(s.start), allDay: false, kind: "study" as const, detail: s.detail })),
  ].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
  const upcomingTasks = open.filter((t) => t.due_at && dayDiff(t.due_at, now, MOCK_TIMEZONE) > 0 && dayDiff(t.due_at, now, MOCK_TIMEZONE) <= 7).sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? "")).slice(0, 3)

  // -------------------------------------------------------------- habits
  const [logs, setLogs] = useState(() => buildMockHabitLogs(nowIso))
  const todaysHabits = mockHabits.filter((h) => !h.paused && isScheduled(h, today))
  const habitsDone = todaysHabits.filter((h) => isDone(h, logs, today)).length

  function toggleHabit(habitId: string, checked: boolean) {
    const habit = mockHabits.find((h) => h.id === habitId)
    if (!habit) return
    setLogs((current) => {
      const rest = current.filter((l) => !(l.habit_id === habitId && l.log_date === today))
      return checked
        ? [...rest, { id: `${habitId}-${today}`, user_id: habit.user_id, habit_id: habitId, log_date: today, qty: habit.type === "goal" ? (habit.target_qty ?? 1) : 1, created_at: nowIso, updated_at: nowIso }]
        : rest
    })
  }

  // ------------------------------------------------------------- finance
  const month = monthOf(today)
  const transactions = buildMockTransactions(nowIso)
  const monthTotals = totals(transactions, month)
  const spentToday = transactions.filter((t) => t.kind === "out" && t.occurred_on === today).reduce((s, t) => s + t.amount_cents, 0)
  const budget = mockCategories.reduce((s, c) => s + (c.monthly_limit_cents ?? 0), 0)
  const budgetSpent = spendByCategory(mockCategories, transactions, month).filter((c) => c.limit).reduce((s, c) => s + c.spent, 0)
  const bills = buildMockBills(nowIso).map((b) => billStatus(b, today)).filter((v) => v.status === "soon" || v.status === "overdue").sort((a, b) => a.dueOn.localeCompare(b.dueOn))

  // ---------------------------------------------------------------- diet
  const mealTotals = dayTotals(buildMockMealItems(), mockFoods)
  const [water, setWater] = useState(1250)

  // -------------------------------------------------------------- studies
  const sessions = buildMockSessions(nowIso)
  const studiedToday = sessions.filter((s) => s.studied_on === today).reduce((s, x) => s + x.minutes, 0)
  const weeklyGoal = mockSubjects.reduce((s, x) => s + x.weekly_goal_min, 0) / 7
  const dueCards = buildMockCards(nowIso).filter((c) => isDue(c, today)).length
  const nextExam = [...buildMockDeadlines(nowIso)].sort((a, b) => a.due_on.localeCompare(b.due_on))[0]

  const [mood, setMood] = useState<Mood | null>(null)
  const workout = agenda.find((a) => a.kind === "workout")

  // ------------------------------------------------------ "Seu dia" timeline
  const billsDue = bills.filter((b) => b.status === "overdue" || b.daysLeft <= 0)
  const pending = [
    ...agenda.filter((i) => i.allDay).map((i) => ({ key: i.key, kind: "event" as const, title: i.title, detail: "Dia todo" })),
    ...focus.filter((t) => overdue.includes(t) || !t.due_at || !t.due_has_time).map((t) => ({ key: t.id, kind: "task" as const, title: t.title, task: t, detail: overdue.includes(t) ? `Atrasada · ${t.boardName}` : t.boardName })),
    ...billsDue.map((b) => ({ key: b.bill.id, kind: "bill" as const, title: b.bill.name, detail: b.status === "overdue" ? `Venceu há ${Math.abs(b.daysLeft)} dias · ${formatBRL(b.bill.amount_cents)}` : `Vence hoje · ${formatBRL(b.bill.amount_cents)}` })),
  ]
  const timed = [
    ...agenda.filter((i) => !i.allDay).map((i) => ({ key: i.key, kind: i.kind, title: i.title, detail: i.detail, at: i.start })),
    ...focus.filter((t) => !overdue.includes(t) && t.due_at && t.due_has_time).map((t) => ({ key: t.id, kind: "task" as const, title: t.title, detail: t.boardName, at: new Date(t.due_at as string), task: t })),
  ].sort((x, y) => x.at.getTime() - y.at.getTime())
  const nowIndex = timed.findIndex((i) => i.at.getTime() > now.getTime())
  const markerAt = nowIndex === -1 ? timed.length : nowIndex
  const timelineEmpty = pending.length === 0 && timed.length === 0 && todaysHabits.length === 0

  const KindIcon = ({ kind }: { kind: "event" | "workout" | "study" | "task" | "bill" }) => {
    const Icon = kind === "workout" ? DumbbellIcon : kind === "study" ? GraduationCapIcon : kind === "bill" ? TriangleAlertIcon : kind === "task" ? SquareCheckIcon : CalendarDaysIcon
    return <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
  }
  const rowClass = "flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0"
  const taskRow = (task: (typeof focus)[number], time?: string, detail?: string) => {
    const checked = completed.has(task.id)
    return (
      <div key={task.id} className={rowClass}>
        {time ? <span className="tabular w-12 shrink-0 text-[13px] leading-5 text-muted-foreground">{time}</span> : null}
        <Checkbox checked={checked} onCheckedChange={() => void toggleTask(task)} aria-label={checked ? `Reabrir ${task.title}` : `Concluir ${task.title}`} />
        <Link href={`/dashboard/tarefas/${task.boardId}`} className="flex min-w-0 flex-1 flex-col rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className={cn("truncate text-[15px] leading-6", checked && "text-muted-foreground line-through")}>{task.title}</span>
          <span className="flex items-center gap-3">
            <DueLabel task={task} now={now} timeZone={MOCK_TIMEZONE} />
            <span className="truncate text-[13px] leading-5 text-muted-foreground">{detail}</span>
          </span>
        </Link>
        <PriorityIcon priority={task.priority} className="shrink-0 text-muted-foreground" />
      </div>
    )
  }
  const nowMarker = (
    <div key="now" role="separator" aria-label={`Agora, ${formatTime(now)}`} className="flex items-center gap-3 py-1">
      <span className="tabular w-12 shrink-0 rounded-full bg-highlight px-2 py-0.5 text-center text-[11px] leading-4 font-semibold text-highlight-foreground">agora</span>
      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-highlight" />
    </div>
  )

  const main = (
    <BentoCard title="Seu dia" href="/dashboard/agenda">
      {timelineEmpty ? (
        <EmptyState
          icon={SquareCheckIcon}
          title="Nada marcado para hoje"
          description="Seu dia está livre. Adicione uma tarefa para começar."
          action={
            <Button variant="outline" onClick={openQuickCapture}>
              <PlusIcon strokeWidth={1.75} /> Adicionar tarefa
            </Button>
          }
          className="py-8"
        />
      ) : (
        <div className="flex flex-col gap-5">
          {planned > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="tabular flex justify-between text-[13px] leading-5">
                <span>Progresso do dia</span>
                <span className="text-muted-foreground">{Math.min(100, progress)}%</span>
              </div>
              <Progress value={Math.min(100, progress)} aria-label="Progresso do dia" />
            </div>
          ) : null}

          {pending.length > 0 ? (
            <div>
              <SectionTitle className="mb-1">Pendências</SectionTitle>
              {pending.map((item) =>
                item.kind === "task" ? (
                  taskRow(item.task, undefined, item.detail)
                ) : (
                  <div key={item.key} className={rowClass}>
                    <KindIcon kind={item.kind} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] leading-6">{item.title}</span>
                      <span className="truncate text-[13px] leading-5 text-muted-foreground">{item.detail}</span>
                    </span>
                    {item.kind === "bill" ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/dashboard/financas">Ver conta</Link>
                      </Button>
                    ) : null}
                  </div>
                )
              )}
            </div>
          ) : null}

          <div>
            <SectionTitle className="mb-1">Linha do tempo</SectionTitle>
            {timed.length === 0 ? <p className="py-3 text-[15px] leading-6 text-muted-foreground">Nenhum compromisso com horário hoje.</p> : null}
            {timed.map((item, index) => (
              <div key={item.key}>
                {index === markerAt ? nowMarker : null}
                {item.kind === "task" ? (
                  taskRow(item.task, formatTime(item.at), item.detail)
                ) : (
                  <div className={rowClass}>
                    <span className="tabular w-12 shrink-0 text-[13px] leading-5 text-muted-foreground">{formatTime(item.at)}</span>
                    <KindIcon kind={item.kind} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] leading-6">{item.title}</span>
                      {item.detail ? <span className="truncate text-[13px] leading-5 text-muted-foreground">{item.detail}</span> : null}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {timed.length > 0 && markerAt === timed.length ? nowMarker : null}
          </div>

          {todaysHabits.length > 0 ? (
            <div>
              <SectionTitle className="mb-1">Rotina, ao longo do dia</SectionTitle>
              {todaysHabits.map((habit) => (
                <HabitCheck
                  key={habit.id}
                  label={habit.name}
                  support={habit.type === "goal" ? `meta: ${habit.target_qty?.toLocaleString("pt-BR")} ${habit.unit}` : undefined}
                  checked={isDone(habit, logs, today)}
                  onCheckedChange={(v) => toggleHabit(habit.id, v)}
                  className="border-b border-border last:border-b-0"
                />
              ))}
            </div>
          ) : null}

          {upcomingTasks.length > 0 ? (
            <div>
              <SectionTitle className="mb-1">Próximas entregas</SectionTitle>
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex min-h-12 items-center gap-3 border-b border-border py-2 last:border-b-0">
                  <SquareCheckIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-[15px] leading-6">{task.title}</span>
                  <span className="tabular text-[13px] leading-5 text-muted-foreground">{formatDue(task, now, MOCK_TIMEZONE)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </BentoCard>
  )

  const aside = (
    <>
      <BentoCard title="Finanças" href="/dashboard/financas">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat size="xs" label="Sobra do mês" value={formatBRL(monthTotals.surplus)} trend={monthTotals.surplus >= 0 ? "up" : "down"} />
            <Stat size="xs" label="Orçamento" value={`${budget === 0 ? 0 : Math.round((budgetSpent / budget) * 100)}%`} support={`${formatBRL(budgetSpent)} de ${formatBRL(budget)}`} />
          </div>
          <Progress value={budget === 0 ? 0 : Math.min(100, (budgetSpent / budget) * 100)} aria-label="Orçamento usado" />
        </div>
      </BentoCard>

      <BentoCard title="Dieta e água" href="/dashboard/dieta">
        <div className="flex flex-col gap-3">
          <div className="tabular flex justify-between text-[15px] leading-6">
            <span>
              {mealTotals.kcal} <span className="text-muted-foreground">de {mockDietGoal.kcal} kcal</span>
            </span>
            <span className="text-muted-foreground">P {Math.round(mealTotals.protein)} g</span>
          </div>
          <Progress value={Math.min(100, (mealTotals.kcal / mockDietGoal.kcal) * 100)} aria-label="Calorias do dia" />
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="tabular text-[13px] leading-5 text-muted-foreground">
              Água: {(water / 1000).toLocaleString("pt-BR")} de {(mockDietGoal.water_ml / 1000).toLocaleString("pt-BR")} L
            </span>
            <Button variant="outline" size="sm" onClick={() => setWater((w) => w + 250)}>
              <GlassWaterIcon strokeWidth={1.75} /> + 250 ml
            </Button>
          </div>
        </div>
      </BentoCard>

      <BentoCard title="Treino e estudos" href="/dashboard/treinos">
        <div className="flex flex-col">
          <div className="flex min-h-12 items-center gap-3 border-b border-border py-2">
            <DumbbellIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-[15px] leading-6">{workout ? workout.title : "Dia de descanso"}</span>
            {workout ? <Badge variant="secondary">{formatTime(workout.start)}</Badge> : null}
          </div>
          <div className="flex min-h-12 items-center gap-3 border-b border-border py-2 last:border-b-0">
            <GraduationCapIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
            <span className="tabular flex-1 text-[15px] leading-6">
              {Math.floor(studiedToday / 60)} h {studiedToday % 60} min hoje <span className="text-muted-foreground">· meta {Math.round((weeklyGoal / 60) * 10) / 10} h</span>
            </span>
            <Link href="/dashboard/estudos" className="text-[13px] leading-5 text-muted-foreground underline underline-offset-4 hover:text-foreground">
              {dueCards} cartões
            </Link>
          </div>
          {nextExam ? (
            <div className="flex min-h-12 items-center gap-3 py-2">
              <span className="flex-1 truncate text-[15px] leading-6">{nextExam.title}</span>
              <Badge variant="highlight">{daysUntil(nextExam.due_on, today)} dias</Badge>
            </div>
          ) : null}
        </div>
      </BentoCard>

      <BentoCard title="Como você está?" href="/dashboard/diario">
        <div role="radiogroup" aria-label="Humor de hoje" className="flex flex-wrap gap-2">
          {MOODS.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mood === value}
              aria-label={MOOD_LABELS[value]}
              title={MOOD_LABELS[value]}
              onClick={() => {
                setMood(value)
                toast.success(`Humor registrado: ${MOOD_LABELS[value].toLowerCase()}.`)
              }}
              className={cn(
                "flex size-12 items-center justify-center rounded-full border border-border outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                mood === value && "border-transparent bg-highlight text-highlight-foreground hover:bg-highlight"
              )}
            >
              <Icon aria-hidden strokeWidth={1.75} className="size-6" />
            </button>
          ))}
        </div>
        <p className="pt-4 text-[13px] leading-5 text-muted-foreground">Um toque por dia alimenta o gráfico do Diário.</p>
      </BentoCard>
    </>
  )

  return (
    // Phones: insight, "Seu dia", stats, side cards. From 1000 px of width: stats, insight, then main + side column.
    <div className="@container">
    <div className="grid min-w-0 grid-cols-1 gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] @min-[880px]:items-start">
      <StatRow min={160} className="order-3 @min-[880px]:order-1 @min-[880px]:col-span-2">
        <KpiCard
          tone="highlight"
          label="Tarefas hoje"
          value={`${pendingCount}`}
          support={planned === 0 ? "0 tarefas" : `${doneToday} ${doneToday === 1 ? "concluída" : "concluídas"} · ${Math.min(100, progress)}% do dia`}
          href="/dashboard/tarefas"
        />
        <KpiCard label="Hábitos" value={`${habitsDone}/${todaysHabits.length}`} support="em dia hoje" href="/dashboard/rotina" />
        <KpiCard label="Gasto de hoje" value={formatBRL(spentToday)} support={`mês: ${formatBRL(monthTotals.expense)}`} href="/dashboard/financas" />
        <KpiCard label="Água" value={`${(water / 1000).toLocaleString("pt-BR")} L`} support={`meta ${(mockDietGoal.water_ml / 1000).toLocaleString("pt-BR")} L`} href="/dashboard/dieta" />
      </StatRow>

      <button
        type="button"
        onClick={openAssistant}
        className="order-1 @min-[880px]:order-2 @min-[880px]:col-span-2 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2 text-left outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SparklesIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[15px] leading-6">Você gastou 12% menos com restaurantes esta semana. Bom ritmo para fechar o mês dentro do orçamento.</span>
        <span className="hidden shrink-0 text-[13px] leading-5 text-muted-foreground sm:inline">Insight · toque para conversar</span>
      </button>

      <div className="order-2 @min-[880px]:order-3 min-w-0">{main}</div>
      <aside className="order-4 flex min-w-0 flex-col gap-4 @min-[880px]:sticky @min-[880px]:top-0">{aside}</aside>
    </div>
    </div>
  )
}
