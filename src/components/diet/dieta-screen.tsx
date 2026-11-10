"use client"

import { DayNavigator } from "@/components/organizzou/DayNavigator"
import { dayNavLabel } from "@/lib/day-label"
import { createContext, useContext, useEffect, useState } from "react"

import { PlusIcon, Settings2Icon, Trash2Icon } from "lucide-react"

import { toast } from "sonner"

import { HistoricoTab, HistoryPeriodSwitch } from "@/components/diet/dieta-historico"
import { Meals, SummaryRow } from "@/components/diet/dieta-hoje"
import { FoodSheet, WeightGoalSheet, WeightSheet, type WeightDraft, type WeightValues } from "@/components/diet/dieta-dialogs"
import { PesoTab } from "@/components/diet/dieta-peso"
import { GoalDialog } from "@/components/diet/goal-dialog"
import { AddPill } from "@/components/finance/parts"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { useIsMobile } from "@/hooks/use-mobile"
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
import { shiftDay } from "@/features/habits/stats"
import { recentFoods } from "@/features/diet/foods"
import type { HistoryPeriod } from "@/features/diet/history"
import { localFoodMetaRepo, type FoodMeta } from "@/features/diet/food-meta"
import { localWeightNoteRepo } from "@/features/diet/weight-notes"
import { sortWeights, type WeightPeriod, withTargetWeight } from "@/features/diet/weight"
import { dayTotals } from "@/features/diet/stats"
import { MEAL_LABELS, type DietGoalRow, type FoodRow, type MealItemRow, type MealKind, type WeightLogRow } from "@/features/diet/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { inTz } from "@/lib/dates"
import { dayOf, SP_TIMEZONE, newId } from "@/lib/sp-time"

const GLASS_ML = 250
const NO_NOTES: Record<string, string> = {}
type TabId = "hoje" | "historico" | "peso"
const TAB_ITEMS = [
  { id: "hoje", label: "Hoje" },
  { id: "historico", label: "Histórico" },
  { id: "peso", label: "Peso" },
]


/** The food catalog (shared rows plus the person's own; the example list only in the local prototype). */
const FoodsContext = createContext<FoodRow[]>([])
const useFoods = () => useContext(FoodsContext)

export type DietInitial = {
  foods: FoodRow[]
  mealItems: MealItemRow[]
  goal: DietGoalRow | null
  weights: WeightLogRow[]
  water: { id: string; log_date: string; ml: number }[]
}

/** What a new person gets before choosing anything (the same numbers the sign-up provisioning stores). */
const DEFAULT_GOAL: DietGoalRow = { user_id: "", kcal: 2000, protein_g: 120, carbs_g: 220, fat_g: 65, water_ml: 2500, target_weight_kg: null }

export function DietaScreen({ nowIso, initial }: { nowIso: string; initial: DietInitial }) {
  // The foods: the shared catalog and the ones the person created (saved like every other table).
  const [foods, setFoods] = usePersistedRows<FoodRow>("foods", initial.foods)
  return (
    <FoodsContext.Provider value={foods}>
      <DietBody nowIso={nowIso} initial={initial} setFoods={setFoods} />
    </FoodsContext.Provider>
  )
}

function DietBody({ nowIso, initial, setFoods }: { nowIso: string; initial: DietInitial; setFoods: (update: (rows: FoodRow[]) => FoodRow[]) => void }) {
  const foods = useFoods()
  const today = dayOf(nowIso)
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<TabId>("hoje")
  const [histPeriod, setHistPeriod] = useState<HistoryPeriod>(15)
  const [editingGoal, setEditingGoal] = useState(false)
  // The daily goals: one row per person (saved through the same hook as every other table; the row id is only a handle for it).
  const [goalRows, setGoalRows] = usePersistedRows<DietGoalRow & { id: string }>("diet_goals", () => (initial.goal ? [{ ...initial.goal, id: "goal" }] : []))
  const goal: DietGoalRow = goalRows[0] ?? DEFAULT_GOAL
  // The day whose diary is open (today by default; the arrows go back through the days that were loaded, never forward).
  const [day, setDay] = useState(today)
  // The meals of the selected day are what the Hoje tab edits; the earlier days also feed the calories chart.
  const [allItems, setAllItems] = usePersistedRows<MealItemRow>("meal_items", initial.mealItems)
  const belongs = (i: MealItemRow) => (i.log_date ?? today) === day
  const items = allItems.filter(belongs)
  const setItems = (update: (current: MealItemRow[]) => MealItemRow[]) => setAllItems((all) => [...all.filter((i) => !belongs(i)), ...update(all.filter(belongs))])
  const [waterRows, setWaterRows] = usePersistedRows<{ id: string; log_date: string; ml: number }>("water_logs", initial.water)
  const water = waterRows.filter((w) => w.log_date === day).reduce((sum, w) => sum + w.ml, 0)
  const setWater = (update: (current: number) => number) => {
    const next = update(water)
    if (next > water) setWaterRows((rows) => [...rows, { id: newId(), log_date: day, ml: next - water }])
    else if (next < water) {
      // Remove the most recent glass of the selected day.
      const last = [...waterRows].reverse().find((w) => w.log_date === day)
      if (last) setWaterRows((rows) => rows.filter((w) => w.id !== last.id))
    }
  }
  const [weights, setWeights] = usePersistedRows<WeightLogRow>("weight_logs", initial.weights)
  const [adding, setAdding] = useState<MealKind | null>(null)
  const [editing, setEditing] = useState<MealItemRow | null>(null)
  const [weighing, setWeighing] = useState<WeightDraft | null>(null)
  const [period, setPeriod] = useState<WeightPeriod>(90)
  const [removedNotes, setNotes] = useState<Record<string, string> | null>(null)
  // Weigh-in notes: localStorage until weight_logs has a note column (see weight-notes.ts).
  const notes = removedNotes ?? NO_NOTES
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(localWeightNoteRepo.load())
  }, [])

  // What a custom food needs beyond its row (deleted flag, fiber): localStorage until the foods columns exist (see food-meta.ts).
  const [foodMeta, setFoodMeta] = useState<FoodMeta>({ archived: [], fiber: {} })
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFoodMeta(localFoodMetaRepo.load())
  }, [])
  // A deleted food only leaves the lists: the rows stay, so the meals already logged with it keep their numbers.
  const pickableFoods = foods.filter((f) => !foodMeta.archived.includes(f.id))
  const updateMeta = (update: (meta: FoodMeta) => FoodMeta) =>
    setFoodMeta((current) => {
      const next = update(current)
      localFoodMetaRepo.save(next)
      return next
    })
  function saveFood(food: FoodRow, fiber: number | null) {
    setFoods((rows) => (rows.some((r) => r.id === food.id) ? rows.map((r) => (r.id === food.id ? food : r)) : [...rows, food]).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")))
    updateMeta((m) => {
      const rest = { ...m.fiber }
      if (fiber === null) delete rest[food.id]
      else rest[food.id] = fiber
      return { ...m, fiber: rest }
    })
    toast.success("Alimento salvo.")
  }
  function deleteFood(food: FoodRow) {
    updateMeta((m) => ({ ...m, archived: [...m.archived, food.id] }))
    toast.success("Alimento excluído.")
  }

  const totals = dayTotals(items, foods)

  function addItem(meal: MealKind, foodId: string, servings: number) {
    setItems((current) => [...current, { id: newId(), log_date: day, meal, food_id: foodId, servings }])
    toast.success("Alimento adicionado.")
  }

  function copyMeal(from: MealKind, to: MealKind) {
    const source = items.filter((i) => i.meal === from)
    setItems((current) => [...current, ...source.map((i) => ({ ...i, id: newId(), log_date: day, meal: to }))])
    toast.success(`${MEAL_LABELS[from]} copiado para ${MEAL_LABELS[to].toLowerCase()}.`)
  }

  const sortedWeights = sortWeights(weights)
  const currentWeight = sortedWeights[sortedWeights.length - 1]?.weight_kg ?? 80
  const target = goal.target_weight_kg
  const [editingTarget, setEditingTarget] = useState(false)
  const openWeigh = (row?: WeightLogRow) => setWeighing({ id: row?.id, date: row?.log_date ?? today, weight: row?.weight_kg ?? currentWeight, note: row ? (notes[row.log_date] ?? "") : "" })

  function saveWeight({ id, date, weight, note }: WeightValues) {
    // One weigh-in per day: saving a day that already has one replaces it (and editing a row to another day moves it).
    setWeights((current) => {
      const rest = id ? current.filter((w) => w.id !== id) : current
      const existing = rest.find((w) => w.log_date === date)
      if (existing) return rest.map((w) => (w === existing ? { ...w, weight_kg: weight } : w))
      return [...rest, { id: id ?? newId(), user_id: "00000000-0000-4000-8000-000000000001", log_date: date, weight_kg: weight }]
    })
    setNotes((current) => {
      const next = { ...(current ?? {}) }
      if (note) next[date] = note
      else delete next[date]
      localWeightNoteRepo.save(next)
      return next
    })
    toast.success("Peso registrado.")
  }

  // The "+ Novo" button adds a food to the meal that fits the time of day.
  const hour = inTz(new Date(nowIso), SP_TIMEZONE).getHours()
  const nextMeal: MealKind = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : "dinner"
  usePrimaryAction(tab === "peso" ? "Registrar peso" : "Adicionar alimento", () => (tab === "peso" ? openWeigh() : setAdding(nextMeal)))

  const tabs = (
    <PillTabs equal={isMobile} className={isMobile ? "grid-cols-3" : "w-fit max-w-full"} ariaLabel="Dieta" items={TAB_ITEMS} value={tab} onSelect={(item) => setTab(item.id as TabId)} />
  )
  const periodSwitch = tab === "historico" ? <HistoryPeriodSwitch value={histPeriod} onChange={setHistPeriod} className={isMobile ? "w-full [&>button]:flex-1" : undefined} /> : null
  const weightAction =
    tab === "peso" ? (
      <Button type="button" data-testid="register-weight" onClick={() => openWeigh()} className="h-9 rounded-full bg-highlight px-4 text-highlight-foreground hover:bg-highlight/90">
        <PlusIcon strokeWidth={1.75} /> Registrar peso
      </Button>
    ) : null
  const dayNav =
    tab === "hoje" ? (
      <DayNavigator testId="diet-day-nav" labelTestId="diet-day-label" label={dayNavLabel(day)} onPrev={() => setDay((d) => shiftDay(d, -1))} onNext={() => setDay((d) => (d >= today ? d : shiftDay(d, 1)))} onToday={() => setDay(today)} nextDisabled={day >= today} />
    ) : null

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="dieta" data-tab={tab}>
      <PageHeader />

      {isMobile ? (
        <>
          <section aria-label="Dieta" data-testid="dieta-header-block" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-border bg-card p-3">
            <div className="flex h-9 items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-[18px] leading-6 font-semibold">Dieta</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Opções da dieta" data-testid="dieta-options" className="relative size-9 rounded-full after:absolute after:-inset-1">
                    <Settings2Icon strokeWidth={1.75} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setAdding(nextMeal)}>
                    <PlusIcon strokeWidth={1.75} /> Adicionar alimento
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openWeigh()}>
                    <PlusIcon strokeWidth={1.75} /> Registrar peso
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {tabs}
          </section>
          {dayNav ? <div className="px-1">{dayNav}</div> : null}
          {periodSwitch}
          {tab === "peso" ? <AddPill label="Registrar peso…" onClick={() => openWeigh()} /> : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {tabs}
          {dayNav}
          {periodSwitch}
          {weightAction}
        </div>
      )}

      {tab === "hoje" ? (
        <div className="@container flex min-w-0 flex-col gap-4" data-testid="dieta-hoje">
          <AddPill label={isMobile ? "Buscar alimento…" : "Buscar alimento… ex.: arroz 100 g no almoço"} onClick={() => setAdding(nextMeal)} />
          <SummaryRow
            isMobile={isMobile}
            totals={totals}
            goal={goal}
            water={water}
            glassMl={GLASS_ML}
            onAddWater={() => {
              setWater((w) => w + GLASS_ML)
              if (water + GLASS_ML >= goal.water_ml && water < goal.water_ml) toast.success("Meta de água batida.")
            }}
            onRemoveWater={() => setWater((w) => Math.max(0, w - GLASS_ML))}
          />
          <Meals
            items={items}
            foods={foods}
            onAdd={setAdding}
            onEdit={setEditing}
            onRemove={(entry) => {
              setItems((current) => current.filter((i) => i.id !== entry.id))
              toast("Alimento removido.")
            }}
            onMove={(entry, to) => {
              setItems((current) => current.map((i) => (i.id === entry.id ? { ...i, meal: to } : i)))
              toast(`Movido para ${MEAL_LABELS[to].toLowerCase()}.`)
            }}
            onCopy={copyMeal}
            onClear={(meal) => {
              setItems((current) => current.filter((i) => i.meal !== meal))
              toast(`${MEAL_LABELS[meal]} limpo.`)
            }}
          />
        </div>
      ) : null}

      {tab === "historico" ? (
        <HistoricoTab
          items={allItems}
          foods={foods}
          water={waterRows}
          goal={goal}
          today={today}
          period={histPeriod}
          isMobile={isMobile}
          onEditGoal={() => setEditingGoal(true)}
          onOpenDay={(d) => {
            setDay(d)
            setTab("hoje")
          }}
        />
      ) : null}

      {tab === "peso" ? (
        <PesoTab
          weights={weights}
          target={target}
          today={today}
          period={period}
          onPeriod={setPeriod}
          isMobile={isMobile}
          notes={notes}
          onRegister={() => openWeigh()}
          onEdit={openWeigh}
          onRemove={(row) => {
            setWeights((current) => current.filter((w) => w.id !== row.id))
            toast("Registro removido.")
          }}
          onGoal={() => setEditingTarget(true)}
        />
      ) : null}

      <GoalDialog
        open={editingGoal}
        goal={goal}
        onOpenChange={setEditingGoal}
        onSave={(values) => {
          setGoalRows((rows) => [{ ...(rows[0] ?? { ...DEFAULT_GOAL, id: "goal" }), ...values }])
          toast.success("Meta atualizada.")
        }}
      />
      <FoodSheet meal={adding} foods={pickableFoods} recents={recentFoods(allItems, pickableFoods)} fiberOf={(id) => foodMeta.fiber[id] ?? null} onClose={() => setAdding(null)} onAdd={addItem} onSaveFood={saveFood} onDeleteFood={deleteFood} />
      <WeightSheet draft={weighing} today={today} onClose={() => setWeighing(null)} onSave={saveWeight} />
      <WeightGoalSheet
        open={editingTarget}
        target={target}
        onClose={() => setEditingTarget(false)}
        onSave={(kg) => {
          setGoalRows((rows) => withTargetWeight(rows, { ...DEFAULT_GOAL, id: "goal" }, kg))
          toast.success(kg === null ? "Meta removida." : "Meta salva.")
        }}
      />
      <EditItemDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(id, servings) => setItems((current) => current.map((i) => (i.id === id ? { ...i, servings } : i)))}
        onRemove={(id) => {
          setItems((current) => current.filter((i) => i.id !== id))
          toast("Alimento removido.")
        }}
      />
    </div>
  )
}

function EditItemDialog({
  item,
  onClose,
  onSave,
  onRemove,
}: {
  item: MealItemRow | null
  onClose: () => void
  onSave: (id: string, servings: number) => void
  onRemove: (id: string) => void
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{item ? <EditItemBody item={item} onClose={onClose} onSave={onSave} onRemove={onRemove} /> : null}</DialogContent>
    </Dialog>
  )
}

function EditItemBody({
  item,
  onClose,
  onSave,
  onRemove,
}: {
  item: MealItemRow
  onClose: () => void
  onSave: (id: string, servings: number) => void
  onRemove: (id: string) => void
}) {
  const food = useFoods().find((f) => f.id === item.food_id)
  const [servings, setServings] = useState(String(item.servings).replace(".", ","))
  const amount = Number(servings.replace(",", ".")) || 0
  if (!food) return null

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (amount <= 0) return
        onSave(item.id, amount)
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{food.name}</DialogTitle>
        <DialogDescription>Porção: {food.serving_label}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-servings">Quantidade de porções</Label>
        <Input id="edit-servings" autoFocus inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            onRemove(item.id)
            onClose()
          }}
        >
          <Trash2Icon strokeWidth={1.75} /> Remover
        </Button>
        <Button type="submit" disabled={amount <= 0}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
