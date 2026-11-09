"use client"

import { useState } from "react"
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  FlameIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  Settings2Icon,
  PlusIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { HojeTab, useGroups, type HojeActions } from "@/components/habits/hoje-tab"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { useIsMobile } from "@/hooks/use-mobile"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import type { HabitLogRow, HabitRow, HabitType } from "@/features/habits/types"
import { dayOf, newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"]
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

type TabId = "hoje" | "historico" | "estatisticas"
const TAB_ITEMS = [
  { id: "hoje", label: "Hoje" },
  { id: "historico", label: "Histórico" },
  { id: "estatisticas", label: "Estatísticas" },
]
const dayName = (day: string) => WEEKDAY_NAMES[parseISO(day).getDay()]

function stepFor(habit: HabitRow) {
  if (habit.unit === "L") return 0.5
  if (habit.unit === "min") return 10
  return 5
}

const chartConfig = { rate: { label: "Constância", color: "var(--chart-1)" } } satisfies ChartConfig

function intensityClass(value: number | null) {
  if (value === null) return "bg-transparent"
  if (value === 0) return "bg-muted"
  if (value < 0.5) return "bg-primary/25"
  if (value < 1) return "bg-primary/60"
  return "bg-primary"
}

export function RotinaScreen({ nowIso, initialHabits, initialLogs }: { nowIso: string; initialHabits: HabitRow[]; initialLogs: HabitLogRow[] }) {
  const today = dayOf(nowIso)
  const [habits, setHabits] = usePersistedRows<HabitRow>("habits", initialHabits)
  const [logs, setLogs] = usePersistedRows<HabitLogRow>("habit_logs", initialLogs)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<HabitRow | null>(null)
  const [historyHabit, setHistoryHabit] = useState("all")
  const [tab, setTab] = useState<TabId>("hoje")
  // The day shown in the Hoje list: today by default, any earlier day through the arrows (never the future).
  const [selected, setSelected] = useState(today)
  const [editing, setEditing] = useState<HabitRow | null>(null)
  const isMobile = useIsMobile()
  const groups = useGroups()

  const active = habits.filter((h) => !h.paused)

  function setQty(habit: HabitRow, qty: number) {
    setLogs((current) => {
      const existing = current.find((l) => l.habit_id === habit.id && l.log_date === selected)
      if (qty <= 0) return current.filter((l) => l !== existing)
      const stamp = new Date().toISOString()
      // The same day keeps the same row: one log per habit per day.
      if (existing) return current.map((l) => (l === existing ? { ...l, qty, updated_at: stamp } : l))
      return [...current, { id: newId(), user_id: habit.user_id, habit_id: habit.id, log_date: selected, qty, created_at: stamp, updated_at: stamp }]
    })
  }

  function toggleFixed(habit: HabitRow) {
    const done = isDone(habit, logs, selected)
    setQty(habit, done ? 0 : 1)
    if (!done) toast.success("Hábito registrado.")
  }

  function stepGoal(habit: HabitRow, direction: 1 | -1) {
    const current = logs.find((l) => l.habit_id === habit.id && l.log_date === selected)?.qty ?? 0
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

  const actions: HojeActions = {
    onToggle: toggleFixed,
    onStep: stepGoal,
    onPause: togglePause,
    onEdit: setEditing,
    onDelete: setToDelete,
    onCreate: () => setCreating(true),
    onOpenStats: () => setTab("estatisticas"),
  }

  const tabs = (
    <PillTabs
      equal={isMobile}
      className={isMobile ? "grid-cols-3" : "w-fit max-w-full"}
      ariaLabel="Rotina"
      items={TAB_ITEMS}
      value={tab}
      onSelect={(item) => setTab(item.id as TabId)}
    />
  )
  const dayNav =
    tab === "hoje" ? (
      <div data-testid="rotina-day-nav" className="flex h-10 items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Dia anterior" className="shrink-0" onClick={() => setSelected((d) => shiftDay(d, -1))}>
          <ChevronLeftIcon strokeWidth={1.75} />
        </Button>
        <button type="button" data-testid="rotina-day-label" aria-label="Ir para hoje" title="Ir para hoje" onClick={() => setSelected(today)} className="min-w-0 rounded-full px-2 text-[15px] leading-6 font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {dayName(selected)}, {format(parseISO(selected), "d 'de' MMMM", { locale: ptBR })}
        </button>
        <Button variant="ghost" size="icon" aria-label="Próximo dia" className="shrink-0" disabled={selected >= today} onClick={() => setSelected((d) => (d >= today ? d : shiftDay(d, 1)))}>
          <ChevronRightIcon strokeWidth={1.75} />
        </Button>
      </div>
    ) : null

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", isMobile && "pb-24")} data-testid="rotina" data-tab={tab}>
      <PageHeader />

      {isMobile ? (
        <>
          <section aria-label="Rotina" data-testid="rotina-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
            <div className="flex h-9 items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-[18px] leading-6 font-semibold">Rotina</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Gerenciar hábitos" data-testid="rotina-manage" className="relative size-9 rounded-full after:absolute after:-inset-1">
                    <Settings2Icon strokeWidth={1.75} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCreating(true)}>
                    <PlusIcon strokeWidth={1.75} /> Novo hábito
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setTab("hoje")
                      groups.open("pausados")
                    }}
                  >
                    <PauseIcon strokeWidth={1.75} /> Mostrar pausados
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {tabs}
          </section>
          {dayNav ? <div className="px-1">{dayNav}</div> : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {tabs}
          {dayNav}
        </div>
      )}

      {tab === "hoje" ? <HojeTab groups={groups} habits={habits} logs={logs} today={today} selected={selected} isMobile={isMobile} actions={actions} /> : null}

      {tab === "historico" ? (
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
      ) : null}

      {tab === "estatisticas" ? (
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
      ) : null}

      <NewHabitDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(habit) => {
          setHabits((current) => [...current, habit])
          toast.success("Hábito criado.")
        }}
      />
      <NewHabitDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        habit={editing}
        onCreate={(habit) => {
          setHabits((current) => current.map((h) => (h.id === habit.id ? { ...habit, created_at: h.created_at, paused: h.paused } : h)))
          toast("Hábito atualizado.")
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
  habit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new habit, or with the edited one (same id) when `habit` is given. */
  onCreate: (habit: HabitRow) => void
  habit?: HabitRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <NewHabitForm habit={habit ?? null} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function NewHabitForm({ habit, onCreate, onClose }: { habit: HabitRow | null; onCreate: (habit: HabitRow) => void; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? "")
  const [type, setType] = useState<HabitType>(habit?.type ?? "fixed")
  const [target, setTarget] = useState(habit?.target_qty ? String(habit.target_qty).replace(".", ",") : "10")
  const [unit, setUnit] = useState(habit?.unit ?? "páginas")
  const [weekdays, setWeekdays] = useState<string[]>((habit?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]).map(String))

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || weekdays.length === 0) return
        const stamp = new Date().toISOString()
        onCreate({
          id: habit?.id ?? newId(),
          user_id: habit?.user_id ?? "00000000-0000-4000-8000-000000000001",
          name: name.trim(),
          type,
          target_qty: type === "goal" ? Number(target.replace(",", ".")) || 1 : null,
          unit: type === "goal" ? unit.trim() || null : null,
          weekdays: weekdays.map(Number),
          deadline: habit?.deadline ?? null,
          paused: habit?.paused ?? false,
          created_at: habit?.created_at ?? stamp,
          updated_at: stamp,
        })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{habit ? "Editar hábito" : "Novo hábito"}</DialogTitle>
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
          {habit ? "Salvar" : "Criar hábito"}
        </Button>
      </DialogFooter>
    </form>
  )
}
