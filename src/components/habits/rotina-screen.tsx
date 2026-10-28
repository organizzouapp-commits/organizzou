"use client"

import { useState } from "react"
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  EllipsisIcon,
  FlameIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { SplitLayout, StatRow } from "@/components/organizzou/layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  bestStreak,
  consistency,
  currentStreak,
  dayCompletion,
  isDone,
  isScheduled,
  shiftDay,
} from "@/features/habits/stats"
import type { HabitLogRow, HabitRow, HabitType } from "@/features/habits/types"
import { buildMockHabitLogs, mockHabits } from "@/mocks/habits"
import { dayOf, mockId } from "@/mocks/time"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"]
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

function stepFor(habit: HabitRow) {
  if (habit.unit === "L") return 0.5
  if (habit.unit === "min") return 10
  return 5
}

function formatQty(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
}

/** Last 7 days of a habit: weekday initial above a 20 px dot (filled = done, ring = missed, plain = day off). */
function WeekDots({ habit, logs, today }: { habit: HabitRow; logs: HabitLogRow[]; today: string }) {
  return (
    <div className="flex items-end gap-1.5" role="group" aria-label={`Últimos 7 dias de ${habit.name}`}>
      {Array.from({ length: 7 }, (_, index) => {
        const day = shiftDay(today, index - 6)
        const doneDay = isDone(habit, logs, day)
        const planned = isScheduled(habit, day)
        const label = format(parseISO(day), "EEEE, d", { locale: ptBR })
        return (
          <span key={day} title={`${label}: ${doneDay ? "feito" : planned ? "não feito" : "folga"}`} className="flex flex-col items-center gap-1">
            <span aria-hidden className="text-[11px] leading-3 font-semibold text-muted-foreground uppercase">
              {format(parseISO(day), "EEEEE", { locale: ptBR })}
            </span>
            <span
              role="img"
              aria-label={`${label}: ${doneDay ? "feito" : planned ? "não feito" : "folga"}`}
              className={cn("size-5 rounded-full border-2", doneDay ? "border-foreground bg-foreground" : planned ? "border-foreground/40" : "border-transparent bg-muted")}
            />
          </span>
        )
      })}
    </div>
  )
}

const chartConfig = { rate: { label: "Constância", color: "var(--chart-1)" } } satisfies ChartConfig

function intensityClass(value: number | null) {
  if (value === null) return "bg-transparent"
  if (value === 0) return "bg-muted"
  if (value < 0.5) return "bg-primary/25"
  if (value < 1) return "bg-primary/60"
  return "bg-primary"
}

export function RotinaScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const [habits, setHabits] = useState<HabitRow[]>(mockHabits)
  const [logs, setLogs] = useState<HabitLogRow[]>(() => buildMockHabitLogs(nowIso))
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<HabitRow | null>(null)
  const [historyHabit, setHistoryHabit] = useState("all")

  const active = habits.filter((h) => !h.paused)
  const todays = active.filter((h) => isScheduled(h, today))
  const doneToday = todays.filter((h) => isDone(h, logs, today)).length

  function setQty(habit: HabitRow, qty: number) {
    setLogs((current) => {
      const rest = current.filter((l) => !(l.habit_id === habit.id && l.log_date === today))
      if (qty <= 0) return rest
      const stamp = new Date().toISOString()
      return [...rest, { id: mockId("log"), user_id: habit.user_id, habit_id: habit.id, log_date: today, qty, created_at: stamp, updated_at: stamp }]
    })
  }

  function toggleFixed(habit: HabitRow) {
    const done = isDone(habit, logs, today)
    setQty(habit, done ? 0 : 1)
    if (!done) toast.success("Hábito registrado.")
  }

  function stepGoal(habit: HabitRow, direction: 1 | -1) {
    const current = logs.find((l) => l.habit_id === habit.id && l.log_date === today)?.qty ?? 0
    const next = Math.max(0, Math.round((current + direction * stepFor(habit)) * 10) / 10)
    setQty(habit, next)
    if (next >= (habit.target_qty ?? 0) && current < (habit.target_qty ?? 0)) toast.success("Meta do dia batida.")
  }

  function togglePause(habit: HabitRow) {
    setHabits((current) => current.map((h) => (h.id === habit.id ? { ...h, paused: !h.paused } : h)))
    toast(habit.paused ? "Hábito retomado." : "Hábito pausado.")
  }

  function confirmDelete() {
    const habit = toDelete
    setToDelete(null)
    if (!habit) return
    setHabits((current) => current.filter((h) => h.id !== habit.id))
    toast("Hábito excluído.")
  }

  // ------------------------------------------------------------ stats
  const best = Math.max(0, ...habits.map((h) => bestStreak(h, logs, today)))
  const overall = active.length === 0 ? 0 : Math.round(active.reduce((sum, h) => sum + consistency(h, logs, today), 0) / active.length)
  const monthCheckins = logs.filter((l) => l.log_date.startsWith(today.slice(0, 7))).length
  const weekly = Array.from({ length: 8 }, (_, index) => {
        const weekEnd = shiftDay(today, -(7 - index - 1) * 7)
        const values = Array.from({ length: 7 }, (_, d) => dayCompletion(habits, logs, shiftDay(weekEnd, -d))).filter(
          (v): v is number => v !== null
        )
        const rate = values.length === 0 ? 0 : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100)
        return { semana: format(parseISO(weekEnd), "dd/MM"), rate }
      })

  // ---------------------------------------------------------- history
  const month = parseISO(today)
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  const historyList = historyHabit === "all" ? habits : habits.filter((h) => h.id === historyHabit)

  usePrimaryAction("Novo hábito", () => setCreating(true))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="pt-5">
          <div className="flex flex-col gap-5">
            <StatRow min={150}>
              <KpiCard tone="highlight" label="Hábitos hoje" value={`${doneToday}/${todays.length}`} support={`${todays.length === 0 ? 0 : Math.round((doneToday / todays.length) * 100)}% do dia`} />
              <KpiCard label="Constância 30 dias" value={`${overall}%`} support="média dos hábitos" />
              <KpiCard label="Melhor sequência" value={`${best}`} support="dias seguidos" />
            </StatRow>
            <SplitLayout
              aside={
                <BentoCard title="Últimos 7 dias" bodyClassName="flex flex-col gap-3">
                  {Array.from({ length: 7 }, (_, index) => {
                    const day = shiftDay(today, index - 6)
                    const value = dayCompletion(active, logs, day)
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-[13px] leading-5 text-muted-foreground capitalize">{format(parseISO(day), "EEE", { locale: ptBR })}</span>
                        <Progress value={value === null ? 0 : value * 100} aria-label={`${format(parseISO(day), "EEEE", { locale: ptBR })}`} />
                        <span className="tabular w-10 shrink-0 text-right text-[13px] leading-5 text-muted-foreground">{value === null ? "—" : `${Math.round(value * 100)}%`}</span>
                      </div>
                    )
                  })}
                </BentoCard>
              }
            >
              <BentoCard title="Hábitos de hoje">
                <div className="flex flex-col gap-2 pb-4">
                  <Progress value={todays.length === 0 ? 0 : (doneToday / todays.length) * 100} aria-label="Progresso dos hábitos de hoje" />
                </div>
                <div className="flex flex-col">
                  {habits.map((habit) => {
                    const scheduled = isScheduled(habit, today)
                    const qty = logs.find((l) => l.habit_id === habit.id && l.log_date === today)?.qty ?? 0
                    const done = isDone(habit, logs, today)
                    const streak = currentStreak(habit, logs, today)
                    return (
                      <div key={habit.id} className={cn("flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0", (habit.paused || !scheduled) && "opacity-60")}>
                        {habit.type === "fixed" ? (
                          <Checkbox checked={done} disabled={habit.paused || !scheduled} onCheckedChange={() => toggleFixed(habit)} aria-label={`Marcar ${habit.name}`} />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" disabled={habit.paused || !scheduled || qty <= 0} aria-label={`Diminuir ${habit.name}`} onClick={() => stepGoal(habit, -1)}>
                              <MinusIcon strokeWidth={1.75} />
                            </Button>
                            <Button variant="outline" size="icon" disabled={habit.paused || !scheduled} aria-label={`Aumentar ${habit.name}`} onClick={() => stepGoal(habit, 1)}>
                              <PlusIcon strokeWidth={1.75} />
                            </Button>
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                          <span className={cn("truncate text-[15px] leading-6", done && "text-muted-foreground line-through")}>{habit.name}</span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-muted-foreground">
                            {habit.paused ? <span>Pausado</span> : null}
                            {!habit.paused && !scheduled ? <span>Folga hoje</span> : null}
                            {!habit.paused && scheduled && habit.type === "goal" ? (
                              <span className="tabular">
                                {formatQty(qty)} / {formatQty(habit.target_qty ?? 0)} {habit.unit}
                              </span>
                            ) : null}
                            {streak > 0 ? (
                              <span className="tabular inline-flex items-center gap-1">
                                <FlameIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
                                {streak} {streak === 1 ? "dia" : "dias"}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <WeekDots habit={habit} logs={logs} today={today} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Opções de ${habit.name}`}>
                              <EllipsisIcon strokeWidth={1.75} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => togglePause(habit)}>
                              {habit.paused ? <PlayIcon strokeWidth={1.75} /> : <PauseIcon strokeWidth={1.75} />}
                              {habit.paused ? "Retomar" : "Pausar"}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(habit)}>
                              <Trash2Icon strokeWidth={1.75} /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  })}
                </div>
              </BentoCard>
            </SplitLayout>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="pt-5">
          <div className="flex flex-col gap-5">
            <div role="group" aria-label="Filtrar por hábito" className="no-scrollbar flex gap-2 overflow-x-auto">
              {[{ id: "all", name: "Todos" }, ...habits].map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={historyHabit === h.id}
                  onClick={() => setHistoryHabit(h.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[14px] outline-none transition-colors duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                    historyHabit === h.id ? "border-transparent bg-highlight font-medium text-highlight-foreground" : "border-border hover:bg-accent"
                  )}
                >
                  {h.name}
                </button>
              ))}
            </div>
            <div className="@container">
              <div className="grid min-w-0 grid-cols-1 gap-5 @min-[880px]:grid-cols-2">
                <BentoCard title={format(month, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}>
                  <div role="grid" aria-label="Calendário de constância" className="grid grid-cols-7 gap-1.5">
                    {WEEKDAY_LABELS.map((label, index) => (
                      <span key={index} className="pb-1 text-center text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        {label}
                      </span>
                    ))}
                    {days.map((day) => {
                      const key = format(day, "yyyy-MM-dd")
                      const value = isSameMonth(day, month) && key <= today ? dayCompletion(historyList, logs, key) : null
                      return (
                        <div
                          key={key}
                          role="gridcell"
                          title={value === null ? format(day, "d 'de' MMMM", { locale: ptBR }) : `${format(day, "d 'de' MMMM", { locale: ptBR })}: ${Math.round(value * 100)}%`}
                          className={cn(
                            "tabular flex aspect-square items-center justify-center rounded-lg text-[13px] leading-5",
                            isSameMonth(day, month) ? intensityClass(value) : "opacity-30",
                            value !== null && value >= 1 && "text-primary-foreground",
                            key === today && "ring-2 ring-ring"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      )
                    })}
                  </div>
                  <p className="flex items-center gap-2 pt-4 text-[13px] leading-5 text-muted-foreground">
                    Menos
                    {["bg-muted", "bg-primary/25", "bg-primary/60", "bg-primary"].map((c) => (
                      <span key={c} className={cn("size-4 rounded-md", c)} />
                    ))}
                    Mais
                  </p>
                </BentoCard>
                <BentoCard title="Por hábito, nas últimas 4 semanas" bodyClassName="flex flex-col">
                  {historyList.map((habit) => {
                    const streak = currentStreak(habit, logs, today)
                    return (
                      <div key={habit.id} className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[15px] leading-6">{habit.name}</span>
                          <span className="tabular inline-flex items-center gap-1 text-[13px] leading-5 text-muted-foreground">
                            <FlameIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
                            {streak} {streak === 1 ? "dia" : "dias"} · melhor {bestStreak(habit, logs, today)}
                          </span>
                        </div>
                        <div className="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-1" aria-label={`Últimos 28 dias de ${habit.name}`}>
                          {Array.from({ length: 28 }, (_, i) => {
                            const day = shiftDay(today, i - 27)
                            const planned = isScheduled(habit, day)
                            return (
                              <span
                                key={day}
                                title={`${format(parseISO(day), "d 'de' MMMM", { locale: ptBR })}: ${isDone(habit, logs, day) ? "feito" : planned ? "não feito" : "folga"}`}
                                className={cn("aspect-square rounded-[4px]", !planned ? "bg-transparent ring-1 ring-border" : isDone(habit, logs, day) ? "bg-primary" : "bg-muted")}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </BentoCard>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="estatisticas" className="pt-5">
          <Bento>
          <KpiCard tone="highlight" label="Constância 30 dias" value={`${overall}%`} support="média dos hábitos" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Melhor sequência" value={`${best}`} support="dias seguidos" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Hábitos ativos" value={`${active.length}`} support={`${habits.length - active.length} pausado`} className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Check-ins no mês" value={`${monthCheckins}`} support="registros" className="col-span-6 @min-[1040px]:col-span-3" />
          <BentoCard title="Constância por semana" className="col-span-12 @min-[900px]:col-span-7 @min-[900px]:h-full">
            <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full @min-[900px]:h-full @min-[900px]:min-h-72">
              <BarChart data={weekly} margin={{ left: -16, right: 4 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="rate" fill="var(--color-rate)" radius={6} />
              </BarChart>
            </ChartContainer>
          </BentoCard>
          <BentoCard title="Por hábito" className="col-span-12 @min-[900px]:col-span-5 @min-[900px]:h-full" bodyClassName="flex flex-col justify-between gap-4">
            {habits.map((habit) => {
              const rate = consistency(habit, logs, today)
              return (
                <div key={habit.id} className="flex flex-col gap-2">
                  <div className="tabular flex justify-between text-[13px] leading-5">
                    <span>{habit.name}</span>
                    <span className="text-muted-foreground">{rate}%</span>
                  </div>
                  <Progress value={rate} aria-label={`Constância de ${habit.name}`} />
                </div>
              )
            })}
          </BentoCard>
          </Bento>
        </TabsContent>
      </Tabs>

      <NewHabitDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(habit) => {
          setHabits((current) => [...current, habit])
          toast.success("Hábito criado.")
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir este hábito?"
        description={toDelete ? `“${toDelete.name}” e todo o histórico dele serão apagados.` : ""}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function NewHabitDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (habit: HabitRow) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <NewHabitForm onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function NewHabitForm({ onCreate, onClose }: { onCreate: (habit: HabitRow) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const [type, setType] = useState<HabitType>("fixed")
  const [target, setTarget] = useState("10")
  const [unit, setUnit] = useState("páginas")
  const [weekdays, setWeekdays] = useState<string[]>(["0", "1", "2", "3", "4", "5", "6"])

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || weekdays.length === 0) return
        const stamp = new Date().toISOString()
        onCreate({
          id: mockId("habit"),
          user_id: "00000000-0000-4000-8000-000000000001",
          name: name.trim(),
          type,
          target_qty: type === "goal" ? Number(target.replace(",", ".")) || 1 : null,
          unit: type === "goal" ? unit.trim() || null : null,
          weekdays: weekdays.map(Number),
          deadline: null,
          paused: false,
          created_at: stamp,
          updated_at: stamp,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Novo hábito</DialogTitle>
        <DialogDescription className="sr-only">Crie um hábito fixo ou com meta diária.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="habit-name">Nome</Label>
        <Input id="habit-name" autoFocus value={name} maxLength={80} placeholder="Ex.: Alongar pela manhã" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Tipo</Label>
        <ToggleGroup type="single" variant="outline" value={type} onValueChange={(v) => v && setType(v as HabitType)} className="justify-start">
          <ToggleGroupItem value="fixed">Fixo (feito ou não)</ToggleGroupItem>
          <ToggleGroupItem value="goal">Meta diária</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {type === "goal" ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-target">Meta por dia</Label>
            <Input id="habit-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-unit">Unidade</Label>
            <Input id="habit-unit" value={unit} maxLength={12} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label>Dias da semana</Label>
        <ToggleGroup type="multiple" variant="outline" value={weekdays} onValueChange={setWeekdays} className="flex-wrap justify-start">
          {WEEKDAY_NAMES.map((dayName, index) => (
            <ToggleGroupItem key={dayName} value={String(index)} aria-label={dayName}>
              {dayName.slice(0, 3)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim() || weekdays.length === 0}>
          Criar hábito
        </Button>
      </DialogFooter>
    </form>
  )
}
