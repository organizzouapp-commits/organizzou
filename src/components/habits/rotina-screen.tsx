"use client"

import { LinkedGoalsStrip } from "@/components/goals/linked-strip"
import { DayNavigator } from "@/components/organizzou/DayNavigator"
import { dayNavLabel } from "@/lib/day-label"
import { useEffect, useMemo, useState } from "react"
import { addMonths, format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
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
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  isDone,
  shiftDay,
} from "@/features/habits/stats"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import type { HabitLogRow, HabitRow, HabitType } from "@/features/habits/types"
import { localHabitMetaRepo, type HabitMetaMap } from "@/features/habits/meta"
import { defaultStep, formatDecimal, isWaterHabit, looksLikeWater, parseDecimal, stepOf, toMl, unitKind } from "@/features/habits/steps"
import { setWater, waterGoalMlOf, withWaterLogs, type WaterLog } from "@/features/habits/water"
import { DEFAULT_DIET_GOAL, type DietGoalRow } from "@/features/diet/types"
import { dayOf, newId } from "@/lib/sp-time"
import { cn } from "@/lib/utils"

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

type TabId = "hoje" | "historico" | "estatisticas"
const TAB_ITEMS = [
  { id: "hoje", label: "Hoje" },
  { id: "historico", label: "Histórico" },
  { id: "estatisticas", label: "Estatísticas" },
]

export function RotinaScreen({ nowIso, initialHabits, initialLogs, initialWater, initialGoal }: { nowIso: string; initialHabits: HabitRow[]; initialLogs: HabitLogRow[]; initialWater: WaterLog[]; initialGoal: DietGoalRow | null }) {
  const today = dayOf(nowIso)
  const [habits, setHabits] = usePersistedRows<HabitRow>("habits", initialHabits)
  const [rawLogs, setLogs] = usePersistedRows<HabitLogRow>("habit_logs", initialLogs)
  // The daily water has ONE source: the Dieta water log and the Dieta water goal. A goal habit in a water unit reads and writes them.
  const [waterRows, setWaterRows] = usePersistedRows<WaterLog>("water_logs", initialWater)
  const [, setGoalRows] = usePersistedRows<DietGoalRow & { id: string }>("diet_goals", () => (initialGoal ? [{ ...initialGoal, id: "goal" }] : []))
  const logs = useMemo(() => withWaterLogs(habits, rawLogs, waterRows), [habits, rawLogs, waterRows])
  const [habitMeta, setHabitMeta] = useState<HabitMetaMap>({})
  useEffect(() => {
    // localStorage only exists in the browser; read after mount so the server and the first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHabitMeta(localHabitMetaRepo.load())
  }, [])
  const [exact, setExact] = useState<HabitRow | null>(null)
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
    if (isWaterHabit(habit)) {
      setWaterRows((current) => setWater(current, day, toMl(qty, habit.unit), newId))
      return
    }
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

  /** "+" and "-" move today's amount by the habit's step (never a jump to done): the habit completes itself when the amount reaches the goal. */
  function stepGoal(habit: HabitRow, direction: 1 | -1, day = selected) {
    const current = logs.find((l) => l.habit_id === habit.id && l.log_date === day)?.qty ?? 0
    const step = stepOf(habit, habitMeta[habit.id]?.step)
    const next = Math.max(0, Math.round((current + direction * step) * 1000) / 1000)
    setQty(habit, next, day)
    if (next >= (habit.target_qty ?? 0) && current < (habit.target_qty ?? 0)) toast.success("Meta do dia batida.")
  }

  /** Saving a water habit makes its goal the water goal of Dieta and Hoje (one number, in ml). */
  function syncWaterGoal(habit: HabitRow) {
    if (!isWaterHabit(habit)) return
    const ml = waterGoalMlOf(habit)
    setGoalRows((rows) => [{ ...(rows[0] ?? { ...DEFAULT_DIET_GOAL, id: "goal" }), water_ml: ml }])
  }

  function saveHabit(habit: HabitRow, step: number | null, isNew: boolean) {
    setHabits((current) => (isNew ? [...current, habit] : current.map((h) => (h.id === habit.id ? { ...habit, created_at: h.created_at, paused: h.paused } : h))))
    setHabitMeta((current) => {
      const next = { ...current }
      if (step && habit.type === "goal") next[habit.id] = { step }
      else delete next[habit.id]
      localHabitMetaRepo.save(next)
      return next
    })
    syncWaterGoal(habit)
    if (isNew) toast.success("Hábito criado.")
    else toast("Hábito atualizado.")
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
    onExact: setExact,
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
      <DayNavigator testId="rotina-day-nav" labelTestId="rotina-day-label" label={dayNavLabel(selected)} onPrev={() => setSelected((d) => shiftDay(d, -1))} onNext={() => setSelected((d) => (d >= today ? d : shiftDay(d, 1)))} onToday={() => setSelected(today)} nextDisabled={selected >= today} />
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
      <LinkedGoalsStrip group="habit" />

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

      <NewHabitDialog open={creating} onOpenChange={setCreating} habitMeta={habitMeta} onCreate={(habit, step) => saveHabit(habit, step, true)} />
      <NewHabitDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} habit={editing} habitMeta={habitMeta} onCreate={(habit, step) => saveHabit(habit, step, false)} />
      <ExactDialog
        key={exact?.id ?? "none"}
        habit={exact}
        current={exact ? (logs.find((l) => l.habit_id === exact.id && l.log_date === selected)?.qty ?? 0) : 0}
        onClose={() => setExact(null)}
        onSave={(habit, qty) => {
          const before = logs.find((l) => l.habit_id === habit.id && l.log_date === selected)?.qty ?? 0
          setQty(habit, qty)
          if (qty >= (habit.target_qty ?? 0) && before < (habit.target_qty ?? 0)) toast.success("Meta do dia batida.")
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
  habitMeta,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new habit, or with the edited one (same id) when `habit` is given, and the step of its "+" (null = the unit default). */
  onCreate: (habit: HabitRow, step: number | null) => void
  habit?: HabitRow | null
  habitMeta: HabitMetaMap
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <NewHabitForm habit={habit ?? null} habitMeta={habitMeta} onCreate={onCreate} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

/** The seven days in one row: equal width toggles (aria-pressed), Lima when selected, never wrapping (not even at 360px). */
function WeekdayChips({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
  return (
    <div role="group" aria-label="Dias da semana" data-testid="weekday-chips" className="grid grid-cols-7 gap-1">
      {WEEKDAY_NAMES.map((dayName, index) => {
        const on = value.includes(index)
        return (
          <button
            key={dayName}
            type="button"
            aria-pressed={on}
            aria-label={dayName}
            data-weekday={index}
            onClick={() => onChange(on ? value.filter((d) => d !== index) : [...value, index].sort())}
            className={cn(
              "relative flex h-11 min-w-0 items-center justify-center rounded-full border text-[13px] leading-5 outline-none transition-[background-color,color,border-color,transform] duration-[250ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              on ? "scale-100 border-transparent bg-highlight font-semibold text-highlight-foreground" : "scale-[0.97] border-border bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {dayName.slice(0, 3)}
          </button>
        )
      })}
    </div>
  )
}

function NewHabitForm({ habit, habitMeta, onCreate, onClose }: { habit: HabitRow | null; habitMeta: HabitMetaMap; onCreate: (habit: HabitRow, step: number | null) => void; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? "")
  const [type, setType] = useState<HabitType>(habit?.type ?? "fixed")
  const [target, setTarget] = useState(habit?.target_qty ? formatDecimal(habit.target_qty) : "10")
  const [unit, setUnit] = useState(habit?.unit ?? "páginas")
  const [stepText, setStepText] = useState(habit && habitMeta[habit.id]?.step ? formatDecimal(habitMeta[habit.id].step as number) : "")
  const [weekdays, setWeekdays] = useState<number[]>(habit?.weekdays ?? [0, 1, 2, 3, 4, 5, 6])
  // "Vincular à água da Dieta": suggested when the name or unit looks like water. Linked means a water unit (L, ml or copos).
  const [linkWater, setLinkWater] = useState(habit ? isWaterHabit(habit) : false)
  const suggest = type === "goal" && looksLikeWater(name, unit) && !linkWater
  const parsedTarget = parseDecimal(target)
  const parsedStep = stepText.trim() === "" ? null : parseDecimal(stepText)
  const stepInvalid = stepText.trim() !== "" && parsedStep === null
  const waterKind = unitKind(unit) === "liter" || unitKind(unit) === "ml" || unitKind(unit) === "cup"
  const effectiveUnit = linkWater && !waterKind ? "L" : unit.trim()
  const valid = Boolean(name.trim()) && weekdays.length > 0 && (type === "fixed" || (parsedTarget !== null && !stepInvalid))

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const stamp = new Date().toISOString()
        onCreate(
          {
            id: habit?.id ?? newId(),
            user_id: habit?.user_id ?? "00000000-0000-4000-8000-000000000001",
            name: name.trim(),
            type,
            target_qty: type === "goal" ? (parsedTarget ?? 1) : null,
            unit: type === "goal" ? effectiveUnit || null : null,
            weekdays,
            deadline: habit?.deadline ?? null,
            paused: habit?.paused ?? false,
            created_at: habit?.created_at ?? stamp,
            updated_at: stamp,
          },
          type === "goal" ? parsedStep : null
        )
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
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="habit-target">Meta por dia</Label>
              <Input id="habit-target" inputMode="decimal" value={target} aria-invalid={parsedTarget === null} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="habit-unit">Unidade</Label>
              <Input id="habit-unit" value={linkWater && !waterKind ? "L" : unit} maxLength={12} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="habit-step">Passo</Label>
              <Input id="habit-step" inputMode="decimal" value={stepText} placeholder={formatDecimal(defaultStep(effectiveUnit))} aria-invalid={stepInvalid} onChange={(e) => setStepText(e.target.value)} />
            </div>
          </div>
          <p className="-mt-3 text-[13px] leading-5 text-muted-foreground">O “+” soma um passo por toque. Aceita decimais com vírgula (3,5).</p>
          {linkWater || suggest ? (
            <label className="flex min-h-11 items-center gap-3 text-[14px] leading-5">
              <Checkbox checked={linkWater} onCheckedChange={(on) => setLinkWater(on === true)} data-testid="link-water" />
              <span>
                Vincular à água da Dieta
                <span className="block text-[13px] text-muted-foreground">A meta vira a meta de água e o “+” registra a água; Hoje e Dieta mostram os mesmos números.</span>
              </span>
            </label>
          ) : null}
        </>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label>Dias da semana</Label>
        <WeekdayChips value={weekdays} onChange={setWeekdays} />
        {weekdays.length === 0 ? <p className="text-[13px] leading-5 text-muted-foreground">Escolha pelo menos um dia.</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid}>
          {habit ? "Salvar" : "Criar hábito"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** The exact amount of a goal habit for the day on show, typed with a decimal comma ("1,25"). */
function ExactDialog({ habit, current, onClose, onSave }: { habit: HabitRow | null; current: number; onClose: () => void; onSave: (habit: HabitRow, qty: number) => void }) {
  const [text, setText] = useState("")
  const typed = text.trim()
  const parsed = typed === "" ? null : typed === "0" ? 0 : parseDecimal(typed)
  return (
    <Dialog open={Boolean(habit)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {habit ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (parsed === null) return
              onSave(habit, parsed)
              onClose()
            }}
          >
            <DialogHeader>
              <DialogTitle>Quantidade do dia</DialogTitle>
              <DialogDescription>
                {habit.name}: meta de {formatDecimal(habit.target_qty ?? 0)} {habit.unit ?? ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exact-qty">Quanto já fez ({habit.unit ?? "unidades"})</Label>
              <Input id="exact-qty" autoFocus inputMode="decimal" defaultValue={formatDecimal(current)} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setText(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={typed !== "" && parsed === null}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
