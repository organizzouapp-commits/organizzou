"use client"

import { useEffect, useState } from "react"
import { addDays, format, parseISO, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CheckIcon,
  DumbbellIcon,
  PlusIcon,
  TimerIcon,
  Trash2Icon,
  TrophyIcon,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart } from "recharts"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader, SectionTitle } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { loadProgress, personalRecords, volume, weeklyVolume } from "@/features/workouts/stats"
import type { PlanExerciseRow, WorkoutPlanRow } from "@/features/workouts/types"
import { cn } from "@/lib/utils"
import { buildMockWorkoutHistory, mockExercises, mockPlanExercises, mockPlans } from "@/mocks/workouts"
import { dayOf, mockId } from "@/mocks/time"

const USER = "00000000-0000-4000-8000-000000000001"
const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

const loadConfig = { load: { label: "Carga (kg)", color: "var(--chart-1)" } } satisfies ChartConfig
const volumeConfig = { volume: { label: "Volume (kg)", color: "var(--chart-1)" } } satisfies ChartConfig

type SetDraft = { reps: string; load: string; done: boolean }

function exerciseName(id: string) {
  return mockExercises.find((e) => e.id === id)?.name ?? "Exercício"
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function kg(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`
}

export function TreinosScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const todayWeekday = parseISO(today).getDay()
  const [plans, setPlans] = useState<WorkoutPlanRow[]>(mockPlans)
  const [planExercises, setPlanExercises] = useState<PlanExerciseRow[]>(mockPlanExercises)
  const [history, setHistory] = useState(() => buildMockWorkoutHistory(nowIso))
  const scheduled = plans.find((p) => p.weekdays.includes(todayWeekday))
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null)
  const activePlan = plans.find((p) => p.id === chosenPlanId) ?? scheduled ?? null
  const [drafts, setDrafts] = useState<Record<string, SetDraft[]>>({})
  const [finishedToday, setFinishedToday] = useState(false)
  const [rest, setRest] = useState<{ remaining: number; total: number; label: string } | null>(null)
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [addingTo, setAddingTo] = useState<WorkoutPlanRow | null>(null)
  const [planToDelete, setPlanToDelete] = useState<WorkoutPlanRow | null>(null)
  const [progressExercise, setProgressExercise] = useState(mockExercises[0].id)

  // Rest timer: ticks once per second while running.
  const restRunning = rest !== null && rest.remaining > 0
  useEffect(() => {
    if (!restRunning) return
    const id = window.setInterval(() => {
      setRest((current) => {
        if (!current) return current
        if (current.remaining <= 1) {
          toast("Descanso terminado. Próxima série!")
          return { ...current, remaining: 0 }
        }
        return { ...current, remaining: current.remaining - 1 }
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [restRunning])

  const items = activePlan ? planExercises.filter((e) => e.plan_id === activePlan.id).sort((a, b) => a.position - b.position) : []

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
        const prev = previousSet(item.exercise_id, index + 1)
        return { reps: String(prev?.reps ?? item.reps), load: String(prev?.load_kg ?? item.target_load_kg ?? ""), done: false }
      })
    )
  }

  function updateDraft(item: PlanExerciseRow, index: number, patch: Partial<SetDraft>) {
    const current = draftsFor(item)
    const next = current.map((d, i) => (i === index ? { ...d, ...patch } : d))
    setDrafts((all) => ({ ...all, [item.id]: next }))
    if (patch.done === true) {
      setRest({ remaining: item.rest_seconds, total: item.rest_seconds, label: exerciseName(item.exercise_id) })
    }
  }

  const doneSets = items.reduce((sum, item) => sum + draftsFor(item).filter((d) => d.done).length, 0)
  const totalSets = items.reduce((sum, item) => sum + item.sets, 0)
  const sessionVolume = items.reduce(
    (sum, item) => sum + volume(draftsFor(item).filter((d) => d.done).map((d) => ({ reps: Number(d.reps) || 0, load_kg: Number(d.load.replace(",", ".")) || 0 }))),
    0
  )

  function finishWorkout() {
    if (!activePlan) return
    const sessionId = mockId("ses")
    const sets = items.flatMap((item) =>
      draftsFor(item)
        .map((d, index) => ({ d, index }))
        .filter(({ d }) => d.done)
        .map(({ d, index }) => ({
          id: mockId("set"),
          session_id: sessionId,
          exercise_id: item.exercise_id,
          set_index: index + 1,
          reps: Number(d.reps) || 0,
          load_kg: Number(d.load.replace(",", ".")) || 0,
        }))
    )
    setHistory((h) => ({
      sessions: [...h.sessions, { id: sessionId, user_id: USER, plan_id: activePlan.id, performed_on: today, duration_min: 58, completed: true }],
      sets: [...h.sets, ...sets],
    }))
    setFinishedToday(true)
    setRest(null)
    toast.success(`Treino concluído: ${doneSets} séries, ${Math.round(sessionVolume).toLocaleString("pt-BR")} kg de volume.`)
  }

  const weekStart = startOfWeek(parseISO(today), { weekStartsOn: 1 })
  const week = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const doneDays = new Set(history.sessions.filter((s) => s.completed).map((s) => s.performed_on))

  const records = personalRecords(history.sets, history.sessions).sort((a, b) => b.oneRepMax - a.oneRepMax)
  const progress = loadProgress(progressExercise, history.sets, history.sessions).map((p) => ({ ...p, label: format(parseISO(p.day), "dd/MM") }))
  const weekly = weeklyVolume(history.sets, history.sessions, today, 8)
  const last4 = weekly.slice(-4).reduce((sum, w) => sum + w.sessions, 0)

  usePrimaryAction("Novo treino", () => setCreatingPlan(true))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="treinos">Meus treinos</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------------- today */}
        <TabsContent value="hoje" className="pt-5">
          <Bento>
          {activePlan ? (
            <>
              <KpiCard tone="highlight" label="Séries" value={`${doneSets}/${totalSets}`} support="feitas hoje" className="col-span-12 sm:col-span-4" />
              <KpiCard label="Volume" value={`${Math.round(sessionVolume).toLocaleString("pt-BR")} kg`} support="levantado hoje" className="col-span-6 sm:col-span-4" />
              <KpiCard label="Exercícios" value={`${items.length}`} support={activePlan.name} className="col-span-6 sm:col-span-4" />
            </>
          ) : null}
          <BentoCard title="Semana" className="col-span-12 lg:col-span-5">
          <div className="grid grid-cols-7 gap-1" role="group" aria-label="Semana">
            {week.map((date) => {
              const key = format(date, "yyyy-MM-dd")
              const planned = plans.some((p) => p.weekdays.includes(date.getDay()))
              const done = doneDays.has(key)
              return (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[13px] leading-5",
                    key === today && "bg-muted"
                  )}
                >
                  <span className="text-[11px] leading-4 uppercase text-muted-foreground">{WEEKDAY_SHORT[date.getDay()]}</span>
                  <span className="tabular text-[15px] font-semibold">{format(date, "d")}</span>
                  <span className="flex size-5 items-center justify-center" title={done ? "Treino feito" : planned ? "Treino previsto" : "Descanso"}>
                    {done ? <CheckIcon aria-hidden strokeWidth={2} className="size-4" /> : planned ? <span aria-hidden className="size-2 rounded-full border border-foreground/50" /> : null}
                    <span className="sr-only">{done ? "Treino feito" : planned ? "Treino previsto" : "Descanso"}</span>
                  </span>
                </div>
              )
            })}
          </div>
          </BentoCard>

          <BentoCard className="col-span-12 lg:col-span-7">
          {!activePlan ? (
            <EmptyState
              icon={DumbbellIcon}
              title="Dia de descanso"
              description="Nenhum treino previsto para hoje. Descansar também faz parte."
              action={
                <Select value="" onValueChange={(v) => { setChosenPlanId(v); setDrafts({}); setFinishedToday(false) }}>
                  <SelectTrigger aria-label="Fazer um treino mesmo assim" className="w-64">
                    <SelectValue placeholder="Fazer um treino mesmo assim" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          ) : (
            <section className="flex flex-col gap-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <SectionTitle>{scheduled?.id === activePlan.id ? "Treino de hoje" : "Treino escolhido"}</SectionTitle>
                  <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">{activePlan.name}</h2>
                </div>
                <div className="flex items-center gap-4">
                  <Select value={activePlan.id} onValueChange={(v) => { setChosenPlanId(v); setDrafts({}); setFinishedToday(false) }}>
                    <SelectTrigger aria-label="Escolher outro treino" className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[17px] leading-6 font-semibold">{exerciseName(item.exercise_id)}</h3>
                      <span className="tabular text-[13px] leading-5 text-muted-foreground">
                        {item.sets} × {item.reps} · descanso {formatClock(item.rest_seconds)}
                      </span>
                    </div>
                    <div role="table" aria-label={`Séries de ${exerciseName(item.exercise_id)}`}>
                      <div role="row" className="grid grid-cols-[2rem_1fr_5rem_4.5rem_2.75rem] items-center gap-2 border-b border-border pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        <span role="columnheader">#</span>
                        <span role="columnheader">Anterior</span>
                        <span role="columnheader">Carga</span>
                        <span role="columnheader">Reps</span>
                        <span role="columnheader" className="sr-only">Feita</span>
                      </div>
                      {draftsFor(item).map((draft, index) => {
                        const prev = previousSet(item.exercise_id, index + 1)
                        return (
                          <div key={index} role="row" className={cn("grid grid-cols-[2rem_1fr_5rem_4.5rem_2.75rem] items-center gap-2 border-b border-border py-1.5", draft.done && "opacity-60")}>
                            <span role="cell" className="tabular text-[15px]">{index + 1}</span>
                            <span role="cell" className="tabular text-[13px] leading-5 text-muted-foreground">
                              {prev ? `${kg(prev.load_kg)} × ${prev.reps}` : "—"}
                            </span>
                            <Input
                              role="cell"
                              aria-label={`Carga da série ${index + 1}`}
                              inputMode="decimal"
                              value={draft.load}
                              onChange={(e) => updateDraft(item, index, { load: e.target.value })}
                              className="tabular h-11 px-2 text-center md:h-9"
                            />
                            <Input
                              role="cell"
                              aria-label={`Repetições da série ${index + 1}`}
                              inputMode="numeric"
                              value={draft.reps}
                              onChange={(e) => updateDraft(item, index, { reps: e.target.value })}
                              className="tabular h-11 px-2 text-center md:h-9"
                            />
                            <span role="cell" className="flex justify-center">
                              <Checkbox
                                checked={draft.done}
                                onCheckedChange={(v) => updateDraft(item, index, { done: v === true })}
                                aria-label={`Série ${index + 1} feita`}
                              />
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" disabled={doneSets === 0 || finishedToday} onClick={finishWorkout}>
                  <CheckIcon strokeWidth={1.75} /> {finishedToday ? "Treino registrado" : "Finalizar treino"}
                </Button>
                {!finishedToday ? <span className="text-[13px] leading-5 text-muted-foreground">Marque as séries feitas para liberar o botão.</span> : null}
              </div>
            </section>
          )}
          </BentoCard>
          </Bento>
        </TabsContent>

        {/* ---------------------------------------------------------- plans */}
        <TabsContent value="treinos" className="pt-5">
          <Bento>
          <BentoCard title="Meus treinos" className="col-span-12 lg:col-span-8">
          <Accordion type="single" collapsible defaultValue={plans[0]?.id}>
            {plans.map((p) => {
              const list = planExercises.filter((e) => e.plan_id === p.id).sort((a, b) => a.position - b.position)
              return (
                <AccordionItem key={p.id} value={p.id}>
                  <AccordionTrigger className="text-left text-[17px] font-semibold">
                    <span className="flex flex-col gap-1">
                      {p.name}
                      <span className="flex flex-wrap gap-1.5">
                        {p.weekdays.map((d) => (
                          <Badge key={d} variant="secondary">{WEEKDAY_SHORT[d]}</Badge>
                        ))}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col">
                      {list.map((e) => (
                        <div key={e.id} className="flex min-h-12 items-center gap-4 border-b border-border py-2 last:border-b-0">
                          <span className="flex-1 text-[15px] leading-6">{exerciseName(e.exercise_id)}</span>
                          <span className="tabular text-[13px] leading-5 text-muted-foreground">
                            {e.sets} × {e.reps}
                            {e.target_load_kg ? ` · ${kg(e.target_load_kg)}` : ""}
                          </span>
                        </div>
                      ))}
                      {list.length === 0 ? <p className="py-3 text-[15px] leading-6 text-muted-foreground">Nenhum exercício ainda.</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-3">
                      <Button variant="outline" size="sm" onClick={() => setAddingTo(p)}>
                        <PlusIcon strokeWidth={1.75} /> Adicionar exercício
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPlanToDelete(p)}>
                        <Trash2Icon strokeWidth={1.75} /> Excluir treino
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
          </BentoCard>
          </Bento>
        </TabsContent>

        {/* ------------------------------------------------------ progress */}
        <TabsContent value="evolucao" className="pt-5">
          <Bento>
          <KpiCard tone="highlight" label="Treinos em 4 semanas" value={`${last4}`} support="sessões concluídas" className="col-span-6 lg:col-span-3" />
          <KpiCard label="Volume da semana" value={`${weekly[weekly.length - 1].volume.toLocaleString("pt-BR")} kg`} support="levantado" className="col-span-6 lg:col-span-3" />
          <KpiCard label="Recordes" value={`${records.length}`} support="exercícios com marca" className="col-span-6 lg:col-span-3" />
          <KpiCard label="Frequência" value={`${(last4 / 4).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/sem`} support="média de 4 semanas" className="col-span-6 lg:col-span-3" />

          <BentoCard
            title="Carga por treino"
            className="col-span-12 lg:col-span-7"
            actions={
              <Select value={progressExercise} onValueChange={setProgressExercise}>
                <SelectTrigger aria-label="Exercício" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockExercises.map((e) => (
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

          <BentoCard title="Volume por semana" className="col-span-12 lg:col-span-5">
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
            <div>
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
        </TabsContent>
      </Tabs>

      {rest ? (
        <div role="timer" aria-live="off" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-border bg-popover p-3 pl-4 text-popover-foreground md:right-6 md:bottom-6 md:left-auto md:mx-0">
          <TimerIcon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Descanso</span>
            <span className="truncate text-[13px] leading-5 text-muted-foreground">{rest.label}</span>
          </div>
          <span className="tabular text-2xl leading-8 font-semibold">{formatClock(rest.remaining)}</span>
          <Button variant="outline" size="sm" onClick={() => setRest({ ...rest, remaining: rest.remaining + 15 })}>
            +15 s
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRest(null)}>
            Pular
          </Button>
        </div>
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
        onCreate({ id: mockId("plan"), user_id: USER, name: name.trim(), weekdays: days.map(Number), created_at: nowIso, updated_at: nowIso })
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
  const [exercise, setExercise] = useState(mockExercises[0].id)
  const [sets, setSets] = useState("3")
  const [reps, setReps] = useState("10")
  const [restSeconds, setRestSeconds] = useState("60")

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd({
          id: mockId("pex"),
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
            {mockExercises.map((e) => (
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
