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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
          <Bento>
          <KpiCard
            tone="highlight"
            label="Hábitos hoje"
            value={`${doneToday}/${todays.length}`}
            support={`${todays.length === 0 ? 0 : Math.round((doneToday / todays.length) * 100)}% do dia`}
            className="col-span-12 @min-[560px]:col-span-4"
          />
          <KpiCard label="Constância 30 dias" value={`${overall}%`} support="média dos hábitos" className="col-span-6 @min-[560px]:col-span-4" />
          <KpiCard label="Melhor sequência" value={`${best}`} support="dias seguidos" className="col-span-6 @min-[560px]:col-span-4" />
          <BentoCard title="Hábitos de hoje" className="col-span-12">
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
                <div
                  key={habit.id}
                  className={cn(
                    "flex min-h-16 items-center gap-4 border-b border-border py-3 last:border-b-0",
                    (habit.paused || !scheduled) && "opacity-60"
                  )}
                >
                  {habit.type === "fixed" ? (
                    <Checkbox
                      checked={done}
                      disabled={habit.paused || !scheduled}
                      onCheckedChange={() => toggleFixed(habit)}
                      aria-label={`Marcar ${habit.name}`}
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon-sm" disabled={habit.paused || !scheduled || qty <= 0} aria-label={`Diminuir ${habit.name}`} onClick={() => stepGoal(habit, -1)}>
                        <MinusIcon strokeWidth={1.75} />
                      </Button>
                      <Button variant="outline" size="icon-sm" disabled={habit.paused || !scheduled} aria-label={`Aumentar ${habit.name}`} onClick={() => stepGoal(habit, 1)}>
                        <PlusIcon strokeWidth={1.75} />
                      </Button>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={cn("truncate text-[15px] leading-6", done && "text-muted-foreground line-through")}>
                      {habit.name}
                    </span>
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
                  <div className="hidden items-center gap-1 sm:flex" aria-label="Últimos 7 dias">
                    {Array.from({ length: 7 }, (_, index) => {
                      const day = shiftDay(today, index - 6)
                      const doneDay = isDone(habit, logs, day)
                      const planned = isScheduled(habit, day)
                      return (
                        <span
                          key={day}
                          title={`${format(parseISO(day), "EEE d", { locale: ptBR })}: ${doneDay ? "feito" : planned ? "não feito" : "folga"}`}
                          className={cn(
                            "size-3 rounded-full border",
                            doneDay ? "border-foreground bg-foreground" : planned ? "border-foreground/40" : "border-transparent bg-muted"
                          )}
                        />
                      )
                    })}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Opções de ${habit.name}`}>
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
          </Bento>
        </TabsContent>

        <TabsContent value="historico" className="pt-5">
          <Bento>
          <BentoCard
            title={format(month, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}
            className="col-span-12 @min-[900px]:col-span-8"
            actions={
              <Select value={historyHabit} onValueChange={setHistoryHabit}>
                <SelectTrigger aria-label="Hábito" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os hábitos</SelectItem>
                  {habits.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
          <div role="grid" aria-label="Calendário de constância" className="grid max-w-xl grid-cols-7 gap-1.5">
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
          <p className="flex items-center gap-2 text-[13px] leading-5 text-muted-foreground">
            Menos
            {["bg-muted", "bg-primary/25", "bg-primary/60", "bg-primary"].map((c) => (
              <span key={c} className={cn("size-4 rounded-md", c)} />
            ))}
            Mais
          </p>
          </BentoCard>
          </Bento>
        </TabsContent>

        <TabsContent value="estatisticas" className="pt-5">
          <Bento>
          <KpiCard tone="highlight" label="Constância 30 dias" value={`${overall}%`} support="média dos hábitos" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Melhor sequência" value={`${best}`} support="dias seguidos" className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Hábitos ativos" value={`${active.length}`} support={`${habits.length - active.length} pausado`} className="col-span-6 @min-[1040px]:col-span-3" />
          <KpiCard label="Check-ins no mês" value={`${monthCheckins}`} support="registros" className="col-span-6 @min-[1040px]:col-span-3" />
          <BentoCard title="Constância por semana" className="col-span-12 @min-[900px]:col-span-7">
            <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
              <BarChart data={weekly} margin={{ left: -16, right: 4 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="rate" fill="var(--color-rate)" radius={6} />
              </BarChart>
            </ChartContainer>
          </BentoCard>
          <BentoCard title="Por hábito" className="col-span-12 @min-[900px]:col-span-5" bodyClassName="flex flex-col gap-4">
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
