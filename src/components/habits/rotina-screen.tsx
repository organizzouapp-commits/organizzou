"use client"

import { useState } from "react"
import { addMonths, format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  Settings2Icon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { HojeTab, useGroups, type HojeActions } from "@/components/habits/hoje-tab"
import { EstatisticasTab, PeriodSwitch } from "@/components/habits/estatisticas-tab"
import { type Period } from "@/features/habits/stats"
import { HistoricoTab, HistoryFilter, HistoryModeSwitch, type HistoryMode } from "@/components/habits/historico-tab"
import { MonthToolbar } from "@/components/finance/parts"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { ConfirmDialog } from "@/components/organizzou/ConfirmDialog"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  isDone,
  shiftDay,
} from "@/features/habits/stats"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import type { HabitLogRow, HabitRow, HabitType } from "@/features/habits/types"
import { dayOf, newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

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

export function RotinaScreen({ nowIso, initialHabits, initialLogs }: { nowIso: string; initialHabits: HabitRow[]; initialLogs: HabitLogRow[] }) {
  const today = dayOf(nowIso)
  const [habits, setHabits] = usePersistedRows<HabitRow>("habits", initialHabits)
  const [logs, setLogs] = usePersistedRows<HabitLogRow>("habit_logs", initialLogs)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<HabitRow | null>(null)
  // Histórico: the habit filter, the month shown, the calendar mode and the selected day (today by default).
  const [hHabit, setHHabit] = useState("all")
  const [hMonth, setHMonth] = useState(today.slice(0, 7))
  const [hMode, setHMode] = useState<HistoryMode>("mes")
  const [hDay, setHDay] = useState(today)
  const [sPeriod, setSPeriod] = useState<Period>(30)
  const [tab, setTab] = useState<TabId>("hoje")
  // The day shown in the Hoje list: today by default, any earlier day through the arrows (never the future).
  const [selected, setSelected] = useState(today)
  const [editing, setEditing] = useState<HabitRow | null>(null)
  const isMobile = useIsMobile()
  const groups = useGroups()

  function setQty(habit: HabitRow, qty: number, day = selected) {
    setLogs((current) => {
      const existing = current.find((l) => l.habit_id === habit.id && l.log_date === day)
      if (qty <= 0) return current.filter((l) => l !== existing)
      const stamp = new Date().toISOString()
      // The same day keeps the same row: one log per habit per day.
      if (existing) return current.map((l) => (l === existing ? { ...l, qty, updated_at: stamp } : l))
      return [...current, { id: newId(), user_id: habit.user_id, habit_id: habit.id, log_date: day, qty, created_at: stamp, updated_at: stamp }]
    })
  }

  function toggleFixed(habit: HabitRow, day = selected) {
    const done = isDone(habit, logs, day)
    setQty(habit, done ? 0 : 1, day)
    if (!done) toast.success("Hábito registrado.")
  }

  function stepGoal(habit: HabitRow, direction: 1 | -1, day = selected) {
    const current = logs.find((l) => l.habit_id === habit.id && l.log_date === day)?.qty ?? 0
    const next = Math.max(0, Math.round((current + direction * stepFor(habit)) * 10) / 10)
    setQty(habit, next, day)
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

  const shiftMonth = (direction: -1 | 1) => {
    const next = format(addMonths(parseISO(`${hMonth}-01`), direction), "yyyy-MM")
    setHMonth(next)
    setHDay(next === today.slice(0, 7) ? today : `${next}-01`)
  }
  const goToday = () => {
    setHMonth(today.slice(0, 7))
    setHDay(today)
  }
  const monthBar = hMode === "mes" ? <MonthToolbar title={format(parseISO(`${hMonth}-01`), "MMMM 'de' yyyy", { locale: ptBR })} onToday={goToday} onShift={shiftMonth} /> : null
  const filter = <HistoryFilter habits={habits} value={hHabit} onChange={setHHabit} />

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
          {tab === "estatisticas" ? <PeriodSwitch value={sPeriod} onChange={setSPeriod} className="w-full [&>button]:flex-1" /> : null}
          {tab === "historico" ? (
            <>
              {monthBar ? <div className="px-1">{monthBar}</div> : null}
              <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4" data-testid="history-controls">
                {filter}
                <HistoryModeSwitch value={hMode} onChange={setHMode} />
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {tabs}
          {dayNav}
          {tab === "estatisticas" ? <PeriodSwitch value={sPeriod} onChange={setSPeriod} /> : null}
          {tab === "historico" ? (
            <div className="flex flex-wrap items-center gap-3">
              {filter}
              {monthBar}
            </div>
          ) : null}
        </div>
      )}

      {tab === "hoje" ? <HojeTab groups={groups} habits={habits} logs={logs} today={today} selected={selected} isMobile={isMobile} actions={actions} /> : null}

      {tab === "historico" ? (
        <HistoricoTab habits={habits} logs={logs} today={today} habitId={hHabit} month={hMonth} mode={hMode} onMode={setHMode} day={hDay} onDay={setHDay} isMobile={isMobile} onToggle={toggleFixed} onStep={stepGoal} />
      ) : null}

      {tab === "estatisticas" ? <EstatisticasTab habits={habits} logs={logs} today={today} period={sPeriod} isMobile={isMobile} onEdit={setEditing} /> : null}

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
