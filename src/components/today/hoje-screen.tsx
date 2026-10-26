"use client"

import { useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AnnoyedIcon,
  ArrowRightIcon,
  DumbbellIcon,
  FrownIcon,
  GlassWaterIcon,
  GraduationCapIcon,
  LaughIcon,
  MehIcon,
  SmileIcon,
  SparklesIcon,
  SquareCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useAssistant } from "@/components/assistant/assistant-context"
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
import { dayDiff, formatDue, greeting, inTz, isOverdue } from "@/lib/dates"
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

function SectionHeader({ title, href, label = "Ver tudo" }: { title: string; href: string; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <SectionTitle>{title}</SectionTitle>
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-md text-[13px] leading-5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label} <ArrowRightIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
      </Link>
    </div>
  )
}

function formatTime(date: Date) {
  const local = inTz(date, MOCK_TIMEZONE)
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`
}

export function HojeScreen({ nowIso, name }: { nowIso: string; name: string }) {
  const now = new Date(nowIso)
  const today = dayOf(nowIso)
  const { openAssistant } = useAssistant()

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
  const firstName = name.split(" ")[0]
  const dateText = format(parseISO(today), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <span className="text-[13px] leading-5 text-muted-foreground">{dateText}</span>
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
          {greeting(now, MOCK_TIMEZONE)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-base leading-6 text-muted-foreground">
          {pendingCount === 0 ? "Tudo certo por hoje." : pendingCount === 1 ? "1 tarefa para hoje." : `${pendingCount} tarefas para hoje.`}
        </p>
      </header>

      <button
        type="button"
        onClick={openAssistant}
        className="flex max-w-3xl items-start gap-3 border-y border-border py-4 text-left outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SparklesIcon aria-hidden strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] leading-6">Você gastou 12% menos com restaurantes esta semana. Bom ritmo para fechar o mês dentro do orçamento.</span>
          <span className="text-[13px] leading-5 text-muted-foreground">Insight do assistente · toque para conversar</span>
        </span>
      </button>

      <section aria-label="Resumo do dia" className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
        <Stat size="sm" label="Tarefas hoje" value={`${pendingCount}`} support={`${doneToday} concluídas`} />
        <Stat size="sm" label="Hábitos" value={`${habitsDone}/${todaysHabits.length}`} support="em dia" />
        <Stat size="sm" label="Gasto de hoje" value={formatBRL(spentToday)} support={`mês: ${formatBRL(monthTotals.expense)}`} />
        <Stat size="sm" label="Água" value={`${(water / 1000).toLocaleString("pt-BR")} L`} support={`meta ${(mockDietGoal.water_ml / 1000).toLocaleString("pt-BR")} L`} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-12 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-12">
          <section className="flex flex-col gap-3">
            <SectionHeader title="Tarefas de hoje" href="/tarefas" />
            <div className="flex flex-col gap-2">
              <div className="tabular flex justify-between text-[13px] leading-5">
                <span>Progresso do dia</span>
                <span className="text-muted-foreground">{Math.min(100, progress)}%</span>
              </div>
              <Progress value={Math.min(100, progress)} aria-label="Progresso do dia" />
            </div>
            {focus.length === 0 ? (
              <p className="py-4 text-[15px] leading-6 text-muted-foreground">Nada marcado para hoje. Aproveite o dia.</p>
            ) : (
              <div>
                {focus.map((task) => {
                  const checked = completed.has(task.id)
                  const late = overdue.includes(task)
                  return (
                    <div key={task.id} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                      <Checkbox checked={checked} onCheckedChange={() => void toggleTask(task)} aria-label={checked ? `Reabrir ${task.title}` : `Concluir ${task.title}`} />
                      <Link href={`/tarefas/${task.boardId}`} className="flex min-w-0 flex-1 flex-col rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <span className={cn("truncate text-[15px] leading-6", checked && "text-muted-foreground line-through")}>{task.title}</span>
                        <span className="flex items-center gap-3">
                          <DueLabel task={task} now={now} timeZone={MOCK_TIMEZONE} />
                          <span className="truncate text-[13px] leading-5 text-muted-foreground">{late ? "Atrasada · " : ""}{task.boardName}</span>
                        </span>
                      </Link>
                      <PriorityIcon priority={task.priority} className="shrink-0 text-muted-foreground" />
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <SectionHeader title="Agenda de hoje" href="/agenda" />
            {agenda.length === 0 ? (
              <p className="py-4 text-[15px] leading-6 text-muted-foreground">Dia livre, sem compromissos.</p>
            ) : (
              agenda.map((item) => (
                <div key={item.key} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                  <span className="tabular w-16 shrink-0 text-[13px] leading-5 text-muted-foreground">{item.allDay ? "Dia todo" : formatTime(item.start)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-[15px] leading-6">
                      {item.kind === "workout" ? <DumbbellIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" /> : null}
                      {item.kind === "study" ? <GraduationCapIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" /> : null}
                      <span className="truncate">{item.title}</span>
                    </span>
                    {item.detail ? <span className="truncate text-[13px] leading-5 text-muted-foreground">{item.detail}</span> : null}
                  </span>
                </div>
              ))
            )}
            {upcomingTasks.length > 0 ? (
              <div className="pt-4">
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
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-12">
          <section className="flex flex-col gap-2">
            <SectionHeader title="Rotina" href="/rotina" />
            {todaysHabits.map((habit) => (
              <HabitCheck
                key={habit.id}
                label={habit.name}
                support={habit.type === "goal" ? `meta: ${habit.target_qty?.toLocaleString("pt-BR")} ${habit.unit}` : undefined}
                checked={isDone(habit, logs, today)}
                onCheckedChange={(v) => toggleHabit(habit.id, v)}
              />
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Finanças" href="/financas" />
            <div className="grid grid-cols-2 gap-4">
              <Stat size="sm" label="Sobra do mês" value={formatBRL(monthTotals.surplus)} trend={monthTotals.surplus >= 0 ? "up" : "down"} />
              <Stat size="sm" label="Orçamento" value={`${budget === 0 ? 0 : Math.round((budgetSpent / budget) * 100)}%`} support={`${formatBRL(budgetSpent)} de ${formatBRL(budget)}`} />
            </div>
            <Progress value={budget === 0 ? 0 : Math.min(100, (budgetSpent / budget) * 100)} aria-label="Orçamento usado" />
            {bills.slice(0, 2).map(({ bill, status, daysLeft }) => (
              <div key={bill.id} className="flex min-h-12 items-center gap-3 border-b border-border py-2 last:border-b-0">
                <TriangleAlertIcon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] leading-6">{bill.name}</span>
                  <span className="text-[13px] leading-5 text-muted-foreground">
                    {status === "overdue" ? `Venceu há ${Math.abs(daysLeft)} dias` : daysLeft === 0 ? "Vence hoje" : `Vence em ${daysLeft} dias`}
                  </span>
                </span>
                <span className="tabular text-[15px]">{formatBRL(bill.amount_cents)}</span>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Dieta e água" href="/dieta" />
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
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Treino e estudos" href="/treinos" label="Treinos" />
            {(() => {
              const workout = agenda.find((a) => a.kind === "workout")
              return (
                <div className="flex min-h-12 items-center gap-3 border-b border-border py-2">
                  <DumbbellIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-[15px] leading-6">{workout ? workout.title : "Dia de descanso"}</span>
                  {workout ? <Badge variant="secondary">{formatTime(workout.start)}</Badge> : null}
                </div>
              )
            })()}
            <div className="flex min-h-12 items-center gap-3 border-b border-border py-2">
              <GraduationCapIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
              <span className="tabular flex-1 text-[15px] leading-6">
                {Math.floor(studiedToday / 60)} h {studiedToday % 60} min hoje <span className="text-muted-foreground">· meta {Math.round(weeklyGoal / 60 * 10) / 10} h</span>
              </span>
              <Link href="/estudos" className="text-[13px] leading-5 text-muted-foreground underline underline-offset-4 hover:text-foreground">
                {dueCards} cartões
              </Link>
            </div>
            {nextExam ? (
              <div className="flex min-h-12 items-center gap-3 py-2">
                <span className="flex-1 truncate text-[15px] leading-6">{nextExam.title}</span>
                <Badge variant="highlight">{daysUntil(nextExam.due_on, today)} dias</Badge>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Como você está?" href="/diario" label="Diário" />
            <div role="radiogroup" aria-label="Humor de hoje" className="flex gap-2">
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
          </section>
        </div>
      </div>
    </div>
  )
}
