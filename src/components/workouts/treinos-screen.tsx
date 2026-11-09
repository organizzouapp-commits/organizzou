"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { addDays, format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ChevronDownIcon,
  DumbbellIcon,
  Trash2Icon,
  TrophyIcon,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart } from "recharts"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ActionBar, AddExerciseRow, ExerciseCard, SummaryRow, WeekStripCard, exerciseIcon, type PlanChoice, type RestState, type WeekDay } from "@/components/workouts/treino-hoje"
import { EmptyBlock } from "@/components/finance/parts"
import { MeusTreinos } from "@/components/workouts/meus-treinos"
import { PromptDialog } from "@/components/organizzou/PromptDialog"
import { addWeekday, reorderExercises, toggleWeekday } from "@/features/workouts/plans"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import { doneVolume, estimatedMinutes, lastVolume, nextPendingSet, planLetter, restAfterSet, type SetDraft } from "@/features/workouts/session"
import { loadProgress, personalRecords, weeklyVolume } from "@/features/workouts/stats"
import type { ExerciseRow, PlanExerciseRow, SetLogRow, WorkoutPlanRow, WorkoutSessionRow } from "@/features/workouts/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { dayOf, newId } from "@/lib/sp-time"

const USER = "00000000-0000-4000-8000-000000000001"
const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

const loadConfig = { load: { label: "Carga (kg)", color: "var(--chart-1)" } } satisfies ChartConfig
const volumeConfig = { volume: { label: "Volume (kg)", color: "var(--chart-1)" } } satisfies ChartConfig

type TabId = "hoje" | "treinos" | "evolucao"
const TAB_ITEMS = [
  { id: "hoje", label: "Hoje" },
  { id: "treinos", label: "Meus treinos" },
  { id: "evolucao", label: "Evolução" },
]
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

/** The exercise catalog (shared rows plus the person's own; the example list only in the local prototype). */
const ExercisesContext = createContext<ExerciseRow[]>([])
const useExercises = () => useContext(ExercisesContext)

function kg(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`
}

export type WorkoutsInitial = { exercises: ExerciseRow[]; plans: WorkoutPlanRow[]; planExercises: PlanExerciseRow[]; sessions: WorkoutSessionRow[]; setLogs: SetLogRow[] }

export function TreinosScreen({ nowIso, initial }: { nowIso: string; initial: WorkoutsInitial }) {
  return (
    <ExercisesContext.Provider value={initial.exercises}>
      <WorkoutsBody nowIso={nowIso} initial={initial} />
    </ExercisesContext.Provider>
  )
}

function WorkoutsBody({ nowIso, initial }: { nowIso: string; initial: WorkoutsInitial }) {
  const exercises = useExercises()
  const exerciseName = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Exercício"
  const today = dayOf(nowIso)
  const isMobile = useIsMobile()
  const [plans, setPlans] = usePersistedRows<WorkoutPlanRow>("workout_plans", initial.plans)
  const [planExercises, setPlanExercises] = usePersistedRows<PlanExerciseRow>("plan_exercises", initial.planExercises)
  const [sessions, setSessions] = usePersistedRows<WorkoutSessionRow>("workout_sessions", initial.sessions)
  const [sets, setSets] = usePersistedRows<SetLogRow>("set_logs", initial.setLogs)
  const history = { sessions, sets }
  const [tab, setTab] = useState<TabId>("hoje")
  // The day shown in Hoje and the workout chosen by hand for a day ("Trocar treino" / "Escolher treino"); without one, the plan of that weekday.
  const [selectedDay, setSelectedDay] = useState(today)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const planFor = (day: string) => plans.find((p) => p.id === overrides[day]) ?? plans.find((p) => p.weekdays.includes(parseISO(day).getDay())) ?? null
  const activePlan = planFor(selectedDay)
  const [drafts, setDrafts] = useState<Record<string, SetDraft[]>>({})
  // For this session only: exercises swapped by "Substituir", cards the person opened or closed, when the first set was checked.
  const [swaps, setSwaps] = useState<Record<string, string>>({})
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({})
  const [swapping, setSwapping] = useState<PlanExerciseRow | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(0)
  const [typing, setTyping] = useState(false)
  const [rest, setRest] = useState<RestState | null>(null)
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [addingTo, setAddingTo] = useState<WorkoutPlanRow | null>(null)
  const [planToDelete, setPlanToDelete] = useState<WorkoutPlanRow | null>(null)
  const [progressExercise, setProgressExercise] = useState(exercises[0]?.id ?? "")
  /** Plans whose exercise list is fully open on a phone ("Ver todos os N exercícios"). */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const finishedToday = Boolean(activePlan && sessions.some((s) => s.performed_on === selectedDay && s.completed && s.plan_id === activePlan.id))

  /** A new day or a new workout starts a fresh session: nothing typed, checked, swapped or running carries over. */
  function resetSession() {
    setDrafts({})
    setSwaps({})
    setOpenCards({})
    setStartedAt(null)
    setRest(null)
  }
  function chooseDay(day: string) {
    setSelectedDay(day)
    resetSession()
  }
  function pickPlan(planId: string) {
    setOverrides((current) => ({ ...current, [selectedDay]: planId }))
    resetSession()
  }

  const [editingExercise, setEditingExercise] = useState<PlanExerciseRow | null>(null)
  const [removingExercise, setRemovingExercise] = useState<PlanExerciseRow | null>(null)
  const [renaming, setRenaming] = useState<WorkoutPlanRow | null>(null)

  /** The workout happens on these weekdays now (a workout can be on several days). */
  function setPlanDays(plan: WorkoutPlanRow, weekdays: number[], change: "added" | "removed", day: number) {
    setPlans((current) => current.map((p) => (p.id === plan.id ? { ...p, weekdays, updated_at: new Date().toISOString() } : p)))
    toast(change === "added" ? `${plan.name} agora também é ${WEEKDAY_NAMES[day]}.` : `${plan.name} saiu de ${WEEKDAY_NAMES[day]}.`)
  }

  /** "Iniciar treino": opens Hoje with this workout chosen for today. */
  function startPlan(plan: WorkoutPlanRow) {
    setOverrides((current) => ({ ...current, [today]: plan.id }))
    setSelectedDay(today)
    resetSession()
    setTab("hoje")
  }

  function duplicatePlan(plan: WorkoutPlanRow) {
    const copy: WorkoutPlanRow = { ...plan, id: newId(), name: `${plan.name} (cópia)` }
    setPlans((current) => [...current, copy])
    setPlanExercises((current) => [...current, ...current.filter((e) => e.plan_id === plan.id).map((e) => ({ ...e, id: newId(), plan_id: copy.id }))])
    toast.success("Treino duplicado.")
  }

  // Rest timer: ticks once per second while running.
  const restRunning = rest !== null && rest.remaining > 0
  useEffect(() => {
    if (!restRunning) return
    const id = window.setInterval(() => {
      setRest((current) => {
        if (!current) return current
        if (current.remaining <= 1) {
          toast("Descanso terminado. Próxima série!")
          return null
        }
        return { ...current, remaining: current.remaining - 1 }
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [restRunning])

  // Elapsed time of the session ticks once per second from the first checked set until the workout is registered.
  const timing = startedAt !== null && !finishedToday
  useEffect(() => {
    if (!timing) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [timing])
  const elapsed = startedAt === null ? null : Math.max(0, Math.floor((nowMs - startedAt) / 1000))

  const items = activePlan ? planExercises.filter((e) => e.plan_id === activePlan.id).sort((a, b) => a.position - b.position) : []

  const exerciseOf = (item: PlanExerciseRow) => swaps[item.id] ?? item.exercise_id

  function previousSet(exerciseId: string, index: number) {
    const last = [...history.sessions]
      .filter((s) => s.plan_id === activePlan?.id)
      .sort((a, b) => b.performed_on.localeCompare(a.performed_on))[0]
    return history.sets.find((s) => s.session_id === last?.id && s.exercise_id === exerciseId && s.set_index === index)
  }

  function draftsFor(item: PlanExerciseRow): SetDraft[] {
    return (
      drafts[item.id] ??
      Array.from({ length: item.sets }, (_, index) => {
        const prev = previousSet(exerciseOf(item), index + 1)
        return { reps: String(prev?.reps ?? item.reps), load: String(prev?.load_kg ?? item.target_load_kg ?? ""), done: false }
      })
    )
  }

  function updateDraft(item: PlanExerciseRow, index: number, patch: Partial<SetDraft>) {
    const current = draftsFor(item)
    const next = current.map((d, i) => (i === index ? { ...d, ...patch } : d))
    setDrafts((all) => ({ ...all, [item.id]: next }))
    if (patch.done === true) {
      if (startedAt === null) {
        const t = Date.now()
        setStartedAt(t)
        setNowMs(t)
      }
      // The rest of THIS exercise starts at once; none after the very last set of the workout.
      const allDone = items.every((it) => (it.id === item.id ? next : draftsFor(it)).every((d) => d.done))
      const seconds = restAfterSet(item.rest_seconds, allDone)
      setRest(seconds > 0 ? { remaining: seconds, total: seconds, label: exerciseName(exerciseOf(item)) } : null)
      // Exercise finished: the next one with sets to do opens.
      if (next.every((d) => d.done)) {
        const following = items.find((it) => it.id !== item.id && !draftsFor(it).every((d) => d.done))
        if (following) setOpenCards((o) => ({ ...o, [following.id]: true }))
      }
    }
  }

  function addSet(item: PlanExerciseRow) {
    const current = draftsFor(item)
    const last = current[current.length - 1]
    setDrafts((all) => ({ ...all, [item.id]: [...current, { reps: last?.reps ?? String(item.reps), load: last?.load ?? "", done: false }] }))
  }

  function swapExercise(item: PlanExerciseRow, exerciseId: string) {
    setSwaps((all) => ({ ...all, [item.id]: exerciseId }))
    // Fresh sets, prefilled from the new exercise's last session.
    setDrafts((all) => {
      const { [item.id]: _removed, ...rest } = all
      void _removed
      return rest
    })
  }

  const doneSets = items.reduce((sum, item) => sum + draftsFor(item).filter((d) => d.done).length, 0)
  const totalSets = items.reduce((sum, item) => sum + draftsFor(item).length, 0)
  const sessionVolume = items.reduce((sum, item) => sum + doneVolume(draftsFor(item)), 0)
  const nextPending = nextPendingSet(items, draftsFor)
  const estimate = estimatedMinutes(items.map((item) => ({ sets: draftsFor(item).length, rest_seconds: item.rest_seconds })))

  function finishWorkout() {
    if (!activePlan) return
    const sessionId = newId()
    const newSets = items.flatMap((item) =>
      draftsFor(item)
        .map((d, index) => ({ d, index }))
        .filter(({ d }) => d.done)
        .map(({ d, index }) => ({
          id: newId(),
          session_id: sessionId,
          exercise_id: exerciseOf(item),
          set_index: index + 1,
          reps: Number(d.reps) || 0,
          load_kg: Number(d.load.replace(",", ".")) || 0,
        }))
    )
    // The session first, then its sets (the sets point at it).
    setSessions((current) => [...current, { id: sessionId, user_id: USER, plan_id: activePlan.id, performed_on: selectedDay, duration_min: elapsed === null ? null : Math.max(1, Math.round(elapsed / 60)), completed: true }])
    setSets((current) => [...current, ...newSets])
    setRest(null)
    toast.success(`Treino concluído: ${doneSets} séries, ${Math.round(sessionVolume).toLocaleString("pt-BR")} kg de volume.`)
  }

  const weekStart = startOfWeek(parseISO(today), { weekStartsOn: 1 })
  const doneDays = new Set(history.sessions.filter((s) => s.completed).map((s) => s.performed_on))
  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    const key = format(date, "yyyy-MM-dd")
    const plan = planFor(key)
    return { key, date, letter: plan ? planLetter(plans, plan.id) : null, planName: plan?.name ?? null, done: doneDays.has(key), today: key === today }
  })
  const planChoices: PlanChoice[] = plans.map((plan) => ({ id: plan.id, letter: planLetter(plans, plan.id), name: plan.name }))

  const records = personalRecords(history.sets, history.sessions).sort((a, b) => b.oneRepMax - a.oneRepMax)
  const progress = loadProgress(progressExercise, history.sets, history.sessions).map((p) => ({ ...p, label: format(parseISO(p.day), "dd/MM") }))
  const weekly = weeklyVolume(history.sets, history.sessions, today, 8)
  const last4 = weekly.slice(-4).reduce((sum, w) => sum + w.sessions, 0)

  usePrimaryAction("Novo treino", () => setCreatingPlan(true))

  const tabs = (
    <PillTabs equal={isMobile} className={isMobile ? "grid-cols-3" : "w-fit max-w-full"} ariaLabel="Treinos" items={TAB_ITEMS} value={tab} onSelect={(item) => setTab(item.id as TabId)} />
  )

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="treinos" data-tab={tab}>
      <PageHeader />

      {isMobile ? (
        <section aria-label="Treinos" data-testid="treinos-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
          <h2 className="h-9 truncate text-[18px] leading-9 font-semibold">Treinos</h2>
          {tabs}
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {tabs}
          {tab === "hoje" ? (
            <p data-testid="treinos-date" className="text-[15px] leading-6 font-semibold">
              {WEEKDAY_NAMES[parseISO(selectedDay).getDay()]}, {format(parseISO(selectedDay), "d 'de' MMMM", { locale: ptBR })}
            </p>
          ) : null}
        </div>
      )}

      {tab === "hoje" ? (
        <div className="@container flex min-w-0 flex-col gap-4 max-md:pb-24 md:gap-5" data-testid="treinos-hoje" onFocusCapture={(e) => setTyping(e.target instanceof HTMLInputElement)} onBlurCapture={() => setTyping(false)}>
          <WeekStripCard days={weekDays} selected={selectedDay} onSelect={chooseDay} isMobile={isMobile} />

          {!activePlan ? (
            <EmptyBlock
              icon={DumbbellIcon}
              title="Descanso"
              description="Nenhum treino previsto para este dia. Descansar também faz parte."
              action={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 rounded-full px-4" data-testid="pick-plan">
                      Escolher treino <ChevronDownIcon strokeWidth={1.75} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="min-w-56">
                    {planChoices.map((plan) => (
                      <DropdownMenuItem key={plan.id} onSelect={() => pickPlan(plan.id)}>
                        <span className="min-w-0 flex-1 truncate">
                          {plan.letter} · {plan.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ) : (
            <>
              <SummaryRow
                isMobile={isMobile}
                today={selectedDay === today}
                letter={planLetter(plans, activePlan.id)}
                name={activePlan.name}
                exercises={items.length}
                totalSets={totalSets}
                doneSets={doneSets}
                estimate={estimate}
                volume={sessionVolume}
                lastTime={lastVolume(sessions, sets, activePlan.id, selectedDay)}
                elapsed={elapsed}
                plans={planChoices}
                activeId={activePlan.id}
                onPick={pickPlan}
              />

              <div className="grid items-start gap-3 @min-[900px]:grid-cols-2" data-testid="exercise-list">
                {items.map((item, position) => {
                  const exerciseId = exerciseOf(item)
                  const exercise = exercises.find((e) => e.id === exerciseId)
                  return (
                    <ExerciseCard
                      key={item.id}
                      name={exerciseName(exerciseId)}
                      icon={exerciseIcon(exercise?.name ?? "", exercise?.muscle_group ?? "")}
                      setsCount={draftsFor(item).length}
                      reps={item.reps}
                      restSeconds={item.rest_seconds}
                      drafts={draftsFor(item)}
                      previous={(index) => previousSet(exerciseId, index)}
                      open={openCards[item.id] ?? position === 0}
                      onToggle={() => setOpenCards((o) => ({ ...o, [item.id]: !(o[item.id] ?? position === 0) }))}
                      next={nextPending?.item.id === item.id ? nextPending.index : null}
                      onChange={(index, patch) => updateDraft(item, index, patch)}
                      onAddSet={() => addSet(item)}
                      onSwap={() => setSwapping(item)}
                    />
                  )
                })}
              </div>
              <AddExerciseRow onClick={() => setAddingTo(activePlan)} />

              <ActionBar
                rest={rest}
                next={nextPending ? { name: exerciseName(exerciseOf(nextPending.item)), set: nextPending.index + 1 } : null}
                doneSets={doneSets}
                totalSets={totalSets}
                canFinish={totalSets > 0 && nextPending === null}
                finished={finishedToday}
                blocked={selectedDay > today ? "Só dá para finalizar hoje ou em dias passados" : null}
                onSkip={() => setRest(null)}
                onFinish={finishWorkout}
                hiddenOnPhone={typing}
              />
            </>
          )}
        </div>
      ) : null}

        {/* ---------------------------------------------------------- plans */}
      {tab === "treinos" ? (
        <MeusTreinos
          plans={plans}
          planExercises={planExercises}
          sets={sets}
          sessions={sessions}
          todayWeekday={parseISO(today).getDay()}
          isMobile={isMobile}
          exerciseName={exerciseName}
          showAll={expanded}
          onToggleShowAll={(id) =>
            setExpanded((current) => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onCreate={() => setCreatingPlan(true)}
          onToggleDay={(plan, day) => setPlanDays(plan, toggleWeekday(plan.weekdays, day), plan.weekdays.includes(day) ? "removed" : "added", day)}
          onDropOnDay={(plan, day) => (plan.weekdays.includes(day) ? toast(`${plan.name} já está nesse dia.`) : setPlanDays(plan, addWeekday(plan.weekdays, day), "added", day))}
          onReorder={(planId, from, to) => setPlanExercises((current) => reorderExercises(current, planId, from, to))}
          onAddExercise={setAddingTo}
          onEditExercise={setEditingExercise}
          onDuplicate={duplicatePlan}
          onRename={setRenaming}
          onDelete={setPlanToDelete}
          onStart={startPlan}
        />
      ) : null}

      {tab === "evolucao" ? (
          <Bento className="@container">
          <KpiCard tone="highlight" label="Treinos em 4 semanas" value={`${last4}`} support="sessões concluídas" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Volume da semana" value={`${weekly[weekly.length - 1].volume.toLocaleString("pt-BR")} kg`} support="levantado" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Recordes" value={`${records.length}`} support="exercícios com marca" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Frequência" value={`${(last4 / 4).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/sem`} support="média de 4 semanas" className="col-span-6 @min-[1040px]:col-span-3" />

          <BentoCard
            title="Carga por treino"
            className="col-span-12 @min-[900px]:col-span-7"
            actions={
              <Select value={progressExercise} onValueChange={setProgressExercise}>
                <SelectTrigger aria-label="Exercício" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <ChartContainer config={loadConfig} className="aspect-[16/8] w-full">
              <LineChart data={progress} margin={{ left: -8, right: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} domain={["dataMin - 5", "dataMax + 5"]} unit=" kg" width={56} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="load" type="monotone" stroke="var(--color-load)" strokeWidth={1.75} dot={false} />
              </LineChart>
            </ChartContainer>
          </BentoCard>

          <BentoCard title="Volume por semana" className="col-span-12 @min-[900px]:col-span-5">
            <ChartContainer config={volumeConfig} className="aspect-[16/10] w-full">
              <BarChart data={weekly} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${(v / 1000).toLocaleString("pt-BR")} t`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="volume" fill="var(--color-volume)" radius={6} />
              </BarChart>
            </ChartContainer>
          </BentoCard>

          <BentoCard title="Recordes pessoais" className="col-span-12">
            <div className="grid gap-x-10 @min-[900px]:grid-cols-2">
              {records.slice(0, 8).map((r) => (
                <div key={r.exerciseId} className="flex min-h-14 items-center gap-4 border-b border-border py-3 last:border-b-0">
                  <TrophyIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] leading-6">{exerciseName(r.exerciseId)}</span>
                    <span className="text-[13px] leading-5 text-muted-foreground">{r.on ? format(parseISO(r.on), "d 'de' MMM yyyy", { locale: ptBR }) : ""}</span>
                  </div>
                  <span className="tabular text-[15px] font-medium">
                    {kg(r.loadKg)} × {r.reps}
                  </span>
                </div>
              ))}
            </div>
          </BentoCard>
          </Bento>
      ) : null}

      <PlanDialog
        open={creatingPlan}
        onOpenChange={setCreatingPlan}
        onCreate={(plan) => {
          setPlans((current) => [...current, plan])
          toast.success("Treino criado.")
        }}
        nowIso={nowIso}
      />
      <AddExerciseDialog
        plan={addingTo}
        onClose={() => setAddingTo(null)}
        position={addingTo ? planExercises.filter((e) => e.plan_id === addingTo.id).length + 1 : 1}
        onAdd={(row) => {
          setPlanExercises((current) => [...current, row])
          toast.success("Exercício adicionado.")
        }}
      />
      <EditExerciseDialog
        row={editingExercise}
        name={editingExercise ? exerciseName(editingExercise.exercise_id) : ""}
        onClose={() => setEditingExercise(null)}
        onSave={(row) => {
          setPlanExercises((current) => current.map((e) => (e.id === row.id ? row : e)))
          toast("Exercício atualizado.")
        }}
        onRemove={(row) => setRemovingExercise(row)}
      />
      <ConfirmDialog
        open={Boolean(removingExercise)}
        onOpenChange={(open) => !open && setRemovingExercise(null)}
        title="Remover este exercício?"
        description={removingExercise ? `“${exerciseName(removingExercise.exercise_id)}” sai do treino. O histórico é mantido.` : ""}
        confirmLabel="Remover"
        onConfirm={() => {
          const row = removingExercise
          setRemovingExercise(null)
          if (!row) return
          setPlanExercises((current) => current.filter((e) => e.id !== row.id))
          toast("Exercício removido.")
        }}
      />
      <PromptDialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Renomear treino"
        label="Nome"
        initialValue={renaming?.name ?? ""}
        submitLabel="Renomear"
        onSubmit={(value) => {
          const plan = renaming
          setRenaming(null)
          const name = value.trim().slice(0, 60)
          if (!plan || !name) return
          setPlans((current) => current.map((p) => (p.id === plan.id ? { ...p, name, updated_at: new Date().toISOString() } : p)))
          toast("Treino renomeado.")
        }}
      />
      <SwapDialog item={swapping} current={swapping ? exerciseOf(swapping) : ""} onClose={() => setSwapping(null)} onSwap={(exerciseId) => swapping && swapExercise(swapping, exerciseId)} />
      <ConfirmDialog
        open={Boolean(planToDelete)}
        onOpenChange={(open) => !open && setPlanToDelete(null)}
        title="Excluir este treino?"
        description={planToDelete ? `“${planToDelete.name}” e os exercícios dele serão apagados. O histórico é mantido.` : ""}
        onConfirm={() => {
          const plan = planToDelete
          setPlanToDelete(null)
          if (!plan) return
          setPlans((current) => current.filter((p) => p.id !== plan.id))
          setPlanExercises((current) => current.filter((e) => e.plan_id !== plan.id))
          toast("Treino excluído.")
        }}
      />
    </div>
  )
}

function PlanDialog({
  open,
  onOpenChange,
  onCreate,
  nowIso,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (plan: WorkoutPlanRow) => void
  nowIso: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <PlanForm nowIso={nowIso} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function PlanForm({ nowIso, onCreate, onClose }: { nowIso: string; onCreate: (plan: WorkoutPlanRow) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const [days, setDays] = useState<string[]>([])

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onCreate({ id: newId(), user_id: USER, name: name.trim(), weekdays: days.map(Number), created_at: nowIso, updated_at: nowIso })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo treino</DialogTitle>
        <DialogDescription className="sr-only">Crie um treino e escolha os dias da semana.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="plan-name">Nome</Label>
        <Input id="plan-name" autoFocus value={name} maxLength={60} placeholder="Ex.: Treino D — Ombros" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Dias da semana</Label>
        <ToggleGroup type="multiple" variant="outline" value={days} onValueChange={setDays} className="flex-wrap justify-start">
          {WEEKDAY_SHORT.map((label, index) => (
            <ToggleGroupItem key={label} value={String(index)}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Criar treino
        </Button>
      </DialogFooter>
    </form>
  )
}

function AddExerciseDialog({
  plan,
  position,
  onClose,
  onAdd,
}: {
  plan: WorkoutPlanRow | null
  position: number
  onClose: () => void
  onAdd: (row: PlanExerciseRow) => void
}) {
  return (
    <Dialog open={Boolean(plan)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{plan ? <AddExerciseForm plan={plan} position={position} onAdd={onAdd} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  )
}

function AddExerciseForm({
  plan,
  position,
  onAdd,
  onClose,
}: {
  plan: WorkoutPlanRow
  position: number
  onAdd: (row: PlanExerciseRow) => void
  onClose: () => void
}) {
  const exercises = useExercises()
  const [exercise, setExercise] = useState(exercises[0]?.id ?? "")
  const [sets, setSets] = useState("3")
  const [reps, setReps] = useState("10")
  const [restSeconds, setRestSeconds] = useState("60")

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd({
          id: newId(),
          plan_id: plan.id,
          exercise_id: exercise,
          position,
          sets: Math.max(1, Number(sets) || 1),
          reps: Math.max(1, Number(reps) || 1),
          rest_seconds: Math.max(0, Number(restSeconds) || 0),
          target_load_kg: null,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Adicionar exercício</DialogTitle>
        <DialogDescription>{plan.name}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ex-select">Exercício</Label>
        <Select value={exercise} onValueChange={setExercise}>
          <SelectTrigger id="ex-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {exercises.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ex-sets">Séries</Label>
          <Input id="ex-sets" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ex-reps">Reps</Label>
          <Input id="ex-reps" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ex-rest">Descanso (s)</Label>
          <Input id="ex-rest" inputMode="numeric" value={restSeconds} onChange={(e) => setRestSeconds(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">Adicionar</Button>
      </DialogFooter>
    </form>
  )
}

function SwapDialog({ item, current, onClose, onSwap }: { item: PlanExerciseRow | null; current: string; onClose: () => void; onSwap: (exerciseId: string) => void }) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{item ? <SwapForm current={current} onSwap={onSwap} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  )
}

function SwapForm({ current, onSwap, onClose }: { current: string; onSwap: (exerciseId: string) => void; onClose: () => void }) {
  const exercises = useExercises()
  const [exercise, setExercise] = useState(current)
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSwap(exercise)
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Substituir exercício</DialogTitle>
        <DialogDescription>Vale só para o treino de hoje; o plano não muda.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="swap-select">Exercício</Label>
        <Select value={exercise} onValueChange={setExercise}>
          <SelectTrigger id="swap-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {exercises.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">Substituir</Button>
      </DialogFooter>
    </form>
  )
}

function EditExerciseDialog({ row, name, onClose, onSave, onRemove }: { row: PlanExerciseRow | null; name: string; onClose: () => void; onSave: (row: PlanExerciseRow) => void; onRemove: (row: PlanExerciseRow) => void }) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{row ? <EditExerciseForm row={row} name={name} onSave={onSave} onRemove={onRemove} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  )
}

function EditExerciseForm({ row, name, onSave, onRemove, onClose }: { row: PlanExerciseRow; name: string; onSave: (row: PlanExerciseRow) => void; onRemove: (row: PlanExerciseRow) => void; onClose: () => void }) {
  const [sets, setSets] = useState(String(row.sets))
  const [reps, setReps] = useState(String(row.reps))
  const [restSeconds, setRestSeconds] = useState(String(row.rest_seconds))
  const [load, setLoad] = useState(row.target_load_kg ? String(row.target_load_kg).replace(".", ",") : "")
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        const parsedLoad = Number(load.replace(",", "."))
        onSave({
          ...row,
          sets: Math.max(1, Number(sets) || 1),
          reps: Math.max(1, Number(reps) || 1),
          rest_seconds: Math.max(0, Number(restSeconds) || 0),
          target_load_kg: Number.isFinite(parsedLoad) && parsedLoad > 0 ? parsedLoad : null,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription>Séries, repetições, descanso e carga inicial deste exercício.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-sets">Séries</Label>
          <Input id="edit-sets" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-reps">Reps</Label>
          <Input id="edit-reps" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-rest">Descanso (s)</Label>
          <Input id="edit-rest" inputMode="numeric" value={restSeconds} onChange={(e) => setRestSeconds(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-load">Carga (kg)</Label>
          <Input id="edit-load" inputMode="decimal" value={load} placeholder="opcional" onChange={(e) => setLoad(e.target.value)} />
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onClose()
            onRemove(row)
          }}
        >
          <Trash2Icon strokeWidth={1.75} /> Remover
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </div>
      </DialogFooter>
    </form>
  )
}
