"use client"

import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { BookOpenIcon, BookMarkedIcon, CalendarDaysIcon, CheckIcon, FlameIcon, GraduationCapIcon, LibraryIcon, PauseIcon, PlayIcon, RotateCcwIcon, TargetIcon, type LucideIcon } from "lucide-react"

import { BentoCard, BentoStat, SegmentedPills } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { AddPill, HatchedProgress, HeroCard } from "@/components/finance/parts"
import { DayDot } from "@/components/habits/hoje-tab"
import type { DayState } from "@/features/habits/stats"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { Button } from "@/components/ui/button"
import {
  averagePerDay,
  bestDay,
  bestStreak,
  currentStreak,
  dailyGoal,
  deadlineChip,
  durationParts,
  durationText,
  minutesByDay,
  nextDeadlines,
  percentOf,
  pomodoroCycle,
  stripState,
  studiedDays,
  type DurationPart,
  type StripState,
} from "@/features/studies/stats"
import type { DeadlineRow, StudySessionRow, SubjectRow, SubjectType } from "@/features/studies/types"
import { cn } from "@/lib/utils"

const TYPE_ICONS: Record<SubjectType, LucideIcon> = { subject: BookOpenIcon, course: GraduationCapIcon, book: BookMarkedIcon, exam: TargetIcon }
const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const SHORT_WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"]

/** A duration with its unit dimmed: "5 h 45 min". */
function Duration({ minutes, small = false }: { minutes: number; small?: boolean }) {
  return (
    <>
      {durationParts(minutes).map((p: DurationPart, i) => (
        <span key={i} className={p.unit ? cn("opacity-60", small ? "text-[13px]" : "text-[16px] leading-6") : undefined}>
          {p.text}
        </span>
      ))}
    </>
  )
}

export type TimerProps = {
  mode: string
  modes: readonly { value: string; label: string }[]
  onMode: (value: string) => void
  remaining: number
  totalSeconds: number
  running: boolean
  onToggle: () => void
  onReset: () => void
  onLog: () => void
  subjectId: string
  onSubject: (id: string) => void
  clock: string
  primaryLabel: string
}

type Props = {
  subjects: SubjectRow[]
  sessions: StudySessionRow[]
  deadlines: DeadlineRow[]
  dueCards: number
  today: string
  weekStart: string
  isMobile: boolean
  timer: TimerProps
  onReview: () => void
  onAllDeadlines: () => void
  onPlanBlock: () => void
  onNewSubject: () => void
}

// ------------------------------------------------------------------ top stat cards

function StatCards({ subjects, sessions, dueCards, today, weekStart, isMobile, onReview }: Pick<Props, "subjects" | "sessions" | "dueCards" | "today" | "weekStart" | "isMobile" | "onReview">) {
  const week = minutesByDay(sessions, weekStart)
  const weekTotal = week.reduce((sum, d) => sum + d.minutes, 0)
  const weekGoal = subjects.reduce((sum, s) => sum + s.weekly_goal_min, 0)
  const todayMinutes = week.find((d) => d.day === today)?.minutes ?? sessions.filter((s) => s.studied_on === today).reduce((sum, s) => sum + s.minutes, 0)
  const goalToday = dailyGoal(weekGoal)
  const days = studiedDays(sessions)
  const streak = currentStreak(days, today)
  const record = Math.max(bestStreak(days), streak)

  const hero = (
    <HeroCard
      key="hero"
      className="h-44"
      density="dense"
      label="Estudado hoje"
      value={<Duration minutes={todayMinutes} />}
      support={goalToday > 0 ? `foco + sessões livres · meta: ${durationText(goalToday)}` : "foco + sessões livres"}
      progress={{ value: percentOf(todayMinutes, goalToday), label: `Estudado hoje: ${percentOf(todayMinutes, goalToday)}% da meta do dia` }}
    />
  )
  const weekCard = (
    <BentoStat key="week" label="Semana" icon={CalendarDaysIcon} className="h-44" chip={weekGoal > 0 ? `meta: ${durationText(weekGoal)}` : "sem meta semanal"} footer={<HatchedProgress value={percentOf(weekTotal, weekGoal)} label={`Semana: ${percentOf(weekTotal, weekGoal)}% da meta`} />}>
      <Duration minutes={weekTotal} />
    </BentoStat>
  )
  const cardsCard = (
    <BentoStat
      key="cards"
      label="Flashcards"
      icon={LibraryIcon}
      className="h-44"
      chip="para revisar"
      footer={
        <Button type="button" data-testid="review-now" onClick={onReview} className="h-9 w-fit rounded-full bg-highlight px-4 text-highlight-foreground hover:bg-highlight/90">
          Revisar agora
        </Button>
      }
    >
      {dueCards}
    </BentoStat>
  )
  const streakCard = (
    <BentoStat key="streak" label="Sequência" icon={FlameIcon} className="h-44" chip={`recorde: ${record} ${record === 1 ? "dia" : "dias"}`}>
      {streak} <span className="text-[16px] leading-6 opacity-60">{streak === 1 ? "dia" : "dias"}</span>
    </BentoStat>
  )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo dos estudos"
        noun="resumo"
        initialHeight={176}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "week", node: weekCard },
          { id: "cards", node: cardsCard },
          { id: "streak", node: streakCard },
        ]}
      />
    )
  }
  return (
    <div data-testid="study-top" className="grid grid-cols-2 gap-4 @min-[880px]:grid-cols-4">
      {[hero, weekCard, cardsCard, streakCard].map((card, i) => (
        <div key={i} className="flex min-w-0 flex-col [&>*]:flex-1">
          {card}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ focus timer

function FocusCard({ subjects, timer, today, sessions, isMobile, onNewSubject, className }: { subjects: SubjectRow[]; timer: TimerProps; today: string; sessions: StudySessionRow[]; isMobile: boolean; onNewSubject: () => void; className?: string }) {
  const size = isMobile ? 200 : 224
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const elapsed = timer.totalSeconds > 0 ? Math.min(1, Math.max(0, (timer.totalSeconds - timer.remaining) / timer.totalSeconds)) : 0
  const subject = subjects.find((s) => s.id === timer.subjectId)
  const { done, cycle } = pomodoroCycle(sessions.filter((s) => s.studied_on === today && s.mode === "pomodoro").length)

  return (
    <BentoCard
      title="Foco"
      data-testid="study-focus"
      className={className}
      actions={
        <span data-chip data-cycle={cycle} className={cn(chip, "gap-2")}>
          Ciclo {cycle} de 4
          <span aria-hidden className="flex items-center gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("size-1.5 rounded-full", i < done ? "bg-primary" : "border border-foreground/40")} />
            ))}
          </span>
        </span>
      }
    >
      <div className="@container flex flex-1 flex-col justify-center gap-5">
        <div className="flex flex-col items-center gap-5 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-8">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
              <circle data-ring cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke="var(--primary)" strokeDasharray={c} strokeDashoffset={c * (1 - elapsed)} className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none" style={{ opacity: elapsed > 0 ? 1 : 0 }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
              <span role="timer" aria-label={`Cronômetro de foco: ${timer.clock}`} data-testid="study-clock" className={cn("tabular font-semibold tracking-[-0.03em]", isMobile ? "text-[44px] leading-[48px]" : "text-[52px] leading-[56px]")}>
                {timer.clock}
              </span>
              <span className="max-w-full truncate text-[13px] leading-5 text-muted-foreground">{subject?.name ?? "Sem matéria"}</span>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
            <SegmentedPills ariaLabel="Modo do cronômetro" items={timer.modes.map((m) => ({ id: m.value, label: m.label }))} value={timer.mode} onChange={timer.onMode} className="w-full [&>button]:flex-1" />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[13px] leading-5 font-medium text-muted-foreground">Estudando</span>
              {subjects.length === 0 ? (
                <AddPill label="Cadastrar uma matéria" onClick={onNewSubject} />
              ) : (
                <PillTabs kind="toggles" ariaLabel="Matéria do cronômetro" items={subjects.map((s) => ({ id: s.id, label: s.name.split(" — ")[0] }))} isOn={(item) => item.id === timer.subjectId} onSelect={(item) => timer.onSubject(item.id)} className="-mx-4 px-4 @min-[560px]:mx-0 @min-[560px]:px-0" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button type="button" data-testid="study-toggle" onClick={timer.onToggle} className="h-12 min-w-0 flex-1 rounded-full bg-highlight px-6 text-[15px] text-highlight-foreground hover:bg-highlight/90">
                  {timer.running ? <PauseIcon strokeWidth={1.75} /> : <PlayIcon strokeWidth={1.75} />}
                  {timer.primaryLabel}
                </Button>
                <Button type="button" variant="outline" onClick={timer.onReset} className="h-12 rounded-full px-5">
                  <RotateCcwIcon strokeWidth={1.75} /> Zerar
                </Button>
              </div>
              <Button type="button" variant="ghost" onClick={timer.onLog} className="h-11 rounded-full">
                <CheckIcon strokeWidth={1.75} /> Registrar o que estudei
              </Button>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ side cards

function BlocksCard({ onPlan, className }: { onPlan: () => void; className?: string }) {
  // Study blocks are not a saved thing (yet): there is no schedule to list, so the card offers to plan one in the Agenda.
  return (
    <BentoCard title="Blocos de hoje" data-testid="study-blocks" className={className}>
      <p className="text-[13px] leading-5 text-muted-foreground">Nenhum bloco no cronograma de hoje.</p>
      <AddPill label="Planejar um bloco de estudo" onClick={onPlan} className="mt-auto" />
    </BentoCard>
  )
}

function CountdownCard({ deadlines, today, onAll, className }: { deadlines: DeadlineRow[]; today: string; onAll: () => void; className?: string }) {
  const next = nextDeadlines(deadlines, today, 3)
  return (
    <BentoCard
      title="Contagem regressiva"
      data-testid="study-countdown"
      className={className}
      actions={
        <Button type="button" variant="outline" onClick={onAll} className="h-9 rounded-full px-4">
          Ver todos
        </Button>
      }
    >
      {next.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Nenhuma prova ou prazo à vista.</p> : null}
      <ul className="flex flex-col divide-y divide-border">
        {next.map((d) => {
          const { text, solid } = deadlineChip(d.due_on, today)
          return (
            <li key={d.id} data-deadline={d.id} className="flex min-h-14 items-center gap-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-6 font-medium">{d.title}</span>
                <span className="truncate text-[12px] leading-4 text-muted-foreground">
                  {format(parseISO(d.due_on), "EEEE, d 'de' MMM", { locale: ptBR }).replace(".", "")} · {d.kind === "exam" ? "Prova" : "Entrega"}
                </span>
              </span>
              <span data-chip={solid ? "solid" : "outline"} className={cn("tabular inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[12px] leading-4 whitespace-nowrap", solid ? "bg-highlight font-semibold text-highlight-foreground" : "border border-foreground/25 text-muted-foreground")}>
                {text}
              </span>
            </li>
          )
        })}
      </ul>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ hours per subject

function HoursCard({ subjects, sessions, weekStart, onNewSubject, className }: { subjects: SubjectRow[]; sessions: StudySessionRow[]; weekStart: string; onNewSubject: () => void; className?: string }) {
  const inWeek = sessions.filter((s) => s.studied_on >= weekStart)
  const rows = subjects.map((s) => ({ subject: s, minutes: inWeek.filter((x) => x.subject_id === s.id).reduce((sum, x) => sum + x.minutes, 0) })).sort((a, b) => b.minutes - a.minutes)
  const total = rows.reduce((sum, r) => sum + r.minutes, 0)
  return (
    <BentoCard title="Horas por matéria nesta semana" data-testid="study-hours" className={className} actions={<span data-chip className={chip}>total {durationText(total)}</span>}>
      {rows.length === 0 ? <AddPill label="Cadastrar a primeira matéria" onClick={onNewSubject} /> : null}
      <ul className="flex flex-col gap-4">
        {rows.map(({ subject, minutes }) => {
          const Icon = TYPE_ICONS[subject.type]
          return (
            <li key={subject.id} data-subject={subject.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-2">
              <span aria-hidden className="row-span-2 flex size-9 items-center justify-center self-center rounded-full border border-border">
                <Icon strokeWidth={1.75} className="size-4" />
              </span>
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14px] leading-5 font-semibold">{subject.name}</span>
                <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">
                  {durationText(minutes)} de {durationText(subject.weekly_goal_min)}
                </span>
              </div>
              <HatchedProgress value={percentOf(minutes, subject.weekly_goal_min)} label={`${subject.name}: ${durationText(minutes)} de ${durationText(subject.weekly_goal_min)}`} className="h-2" />
            </li>
          )
        })}
      </ul>
    </BentoCard>
  )
}

// ------------------------------------------------------------------ days studied

const DOT: Record<StripState, DayState> = { done: "done", today: "pending", missed: "missed", future: "off" }
const STRIP_TEXT: Record<StripState, string> = { done: "estudou", today: "hoje, ainda sem estudo", missed: "não estudou", future: "ainda não chegou" }

function DaysCard({ sessions, today, weekStart, className }: { sessions: StudySessionRow[]; today: string; weekStart: string; className?: string }) {
  const week = minutesByDay(sessions, weekStart)
  const studied = studiedDays(sessions)
  const streak = currentStreak(studied, today)
  const best = bestDay(week)
  const average = averagePerDay(week, today)
  return (
    <BentoCard title="Dias estudados" data-testid="study-days" className={className} actions={<span data-chip className={chip}>{streak === 0 ? "sem sequência" : `${streak} ${streak === 1 ? "dia seguido" : "dias seguidos"}`}</span>}>
      <ul aria-label="Dias da semana" className="grid grid-cols-7 gap-1">
        {week.map(({ day }, i) => {
          const state = stripState(day, today, studied)
          return (
            <li key={day} data-day-state={state} className="flex flex-col items-center gap-2">
              <span className={cn("text-[12px] leading-4", state === "today" ? "font-bold" : "text-muted-foreground")}>{LETTERS[i]}</span>
              <DayDot state={DOT[state]} size="size-7" />
              <span className="sr-only">
                {SHORT_WEEKDAY[parseISO(day).getDay()]}, {format(parseISO(day), "d")}: {STRIP_TEXT[state]}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto grid grid-cols-2 gap-3">
        <div data-tile="best" className="flex flex-col gap-0.5 rounded-[14px] border border-border p-3">
          <span className="text-[11px] leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase">Melhor dia</span>
          <span className="tabular text-[16px] leading-6 font-semibold">{best ? `${capitalize(SHORT_WEEKDAY[parseISO(best.day).getDay()])} · ${durationText(best.minutes)}` : "—"}</span>
        </div>
        <div data-tile="average" className="flex flex-col gap-0.5 rounded-[14px] border border-border p-3">
          <span className="text-[11px] leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase">Média/dia</span>
          <span className="tabular text-[16px] leading-6 font-semibold">{durationText(average)}</span>
        </div>
      </div>
    </BentoCard>
  )
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// ------------------------------------------------------------------ the tab

export function HojeTab(props: Props) {
  const { subjects, sessions, deadlines, today, weekStart, isMobile, timer } = props
  const stats = <StatCards subjects={subjects} sessions={sessions} dueCards={props.dueCards} today={today} weekStart={weekStart} isMobile={isMobile} onReview={props.onReview} />
  const focus = <FocusCard subjects={subjects} timer={timer} today={today} sessions={sessions} isMobile={isMobile} onNewSubject={props.onNewSubject} className="h-full" />
  const blocks = <BlocksCard onPlan={props.onPlanBlock} className="flex-1" />
  const countdown = <CountdownCard deadlines={deadlines} today={today} onAll={props.onAllDeadlines} className="flex-1" />
  const hours = <HoursCard subjects={subjects} sessions={sessions} weekStart={weekStart} onNewSubject={props.onNewSubject} className="h-full" />
  const days = <DaysCard sessions={sessions} today={today} weekStart={weekStart} className="h-full" />

  if (isMobile) {
    // Phone order: summary, focus, countdown, blocks, hours, days.
    return (
      <div data-testid="estudos-hoje" className="flex min-w-0 flex-col gap-4">
        {stats}
        {focus}
        {countdown}
        {blocks}
        {hours}
        {days}
      </div>
    )
  }
  return (
    <div data-testid="estudos-hoje" className="@container flex min-w-0 flex-col gap-4">
      {stats}
      <div className="grid grid-cols-1 gap-4 @min-[880px]:grid-cols-12">
        <div className="min-w-0 @min-[880px]:col-span-8">{focus}</div>
        <div className="flex min-w-0 flex-col gap-4 @min-[880px]:col-span-4">
          {blocks}
          {countdown}
        </div>
        <div className="min-w-0 @min-[880px]:col-span-8">{hours}</div>
        <div className="min-w-0 @min-[880px]:col-span-4">{days}</div>
      </div>
    </div>
  )
}
