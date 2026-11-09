"use client"

import { createContext, useContext, useState } from "react"
import { format, parseISO } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, Settings2Icon, Trash2Icon } from "lucide-react"
import { ptBR } from "date-fns/locale"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { Meals, SummaryRow } from "@/components/diet/dieta-hoje"
import { AddPill } from "@/components/finance/parts"
import { PillTabs } from "@/components/tasks/pill-tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { Bento, BentoCard, KpiCard } from "@/components/organizzou/Bento"
import { PageHeader } from "@/components/organizzou/PageHeader"
import { usePrimaryAction } from "@/components/shell/primary-action"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
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
import { shiftDay } from "@/features/habits/stats"
import { dayTotals, itemMacros } from "@/features/diet/stats"
import { MEAL_LABELS, type DietGoalRow, type FoodRow, type MealItemRow, type MealKind, type WeightLogRow } from "@/features/diet/types"
import { usePersistedRows } from "@/features/persist/use-persisted-rows"
import { inTz } from "@/lib/dates"
import { dayOf, SP_TIMEZONE, newId } from "@/lib/sp-time"

const GLASS_ML = 250
type TabId = "hoje" | "historico" | "peso"
const TAB_ITEMS = [
  { id: "hoje", label: "Hoje" },
  { id: "historico", label: "Histórico" },
  { id: "peso", label: "Peso" },
]
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

const kcalConfig = { kcal: { label: "Calorias", color: "var(--chart-1)" } } satisfies ChartConfig
const weightConfig = { weight: { label: "Peso (kg)", color: "var(--chart-1)" } } satisfies ChartConfig

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
  return (
    <FoodsContext.Provider value={initial.foods}>
      <DietBody nowIso={nowIso} initial={initial} />
    </FoodsContext.Provider>
  )
}

function DietBody({ nowIso, initial }: { nowIso: string; initial: DietInitial }) {
  const foods = useFoods()
  const today = dayOf(nowIso)
  const goal = initial.goal ?? DEFAULT_GOAL
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<TabId>("hoje")
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
  const [weighing, setWeighing] = useState(false)
  const [period, setPeriod] = useState("90")
  // Earlier days: from the saved meals (days with no meals logged are not counted as zero), the example series in the prototype.
  const history = [...new Set(allItems.map((i) => i.log_date).filter((d): d is string => Boolean(d) && d !== today))].sort().map((day) => ({ day, kcal: dayTotals(allItems.filter((i) => i.log_date === day), foods).kcal }))

  const totals = dayTotals(items, foods)
  // The chart of the Histórico tab always ends on today, whatever day the Hoje tab is showing.
  const todayTotals = dayTotals(allItems.filter((i) => (i.log_date ?? today) === today), foods)

  function addItem(meal: MealKind, foodId: string, servings: number) {
    setItems((current) => [...current, { id: newId(), log_date: day, meal, food_id: foodId, servings }])
    toast.success("Alimento adicionado.")
  }

  function copyMeal(from: MealKind, to: MealKind) {
    const source = items.filter((i) => i.meal === from)
    setItems((current) => [...current, ...source.map((i) => ({ ...i, id: newId(), log_date: day, meal: to }))])
    toast.success(`${MEAL_LABELS[from]} copiado para ${MEAL_LABELS[to].toLowerCase()}.`)
  }

  const kcalSeries = [
    ...history.map((h) => ({ label: format(parseISO(h.day), "dd/MM"), kcal: h.kcal })),
    { label: "Hoje", kcal: todayTotals.kcal },
  ]
  const hitDays = kcalSeries.filter((d) => d.kcal <= goal.kcal && d.kcal >= goal.kcal * 0.85).length
  const averageKcal = Math.round(kcalSeries.reduce((s, d) => s + d.kcal, 0) / kcalSeries.length)
  // One point per day, in date order: the card, the variation and the chart all read the same sorted list.
  const sortedWeights = [...weights].sort((a, b) => a.log_date.localeCompare(b.log_date))
  const periodDays = period === "30" ? 30 : period === "90" ? 90 : 365
  const inPeriod = sortedWeights.filter((w) => w.log_date >= shiftDay(today, -periodDays))
  const periodWeights = inPeriod.length >= 2 ? inPeriod : sortedWeights
  const weightSeries = periodWeights.map((w) => ({ label: format(parseISO(w.log_date), "dd/MM"), weight: w.weight_kg }))
  const currentWeight = sortedWeights[sortedWeights.length - 1]?.weight_kg ?? 0
  const firstWeight = periodWeights[0]?.weight_kg ?? currentWeight
  // The y-axis always contains every point and the target line, with a little room.
  const target = goal.target_weight_kg
  const weightValues = [...periodWeights.map((w) => w.weight_kg), ...(target === null ? [] : [target])]
  const hasWeights = weightValues.length > 0
  const weightDomain: [number, number] = hasWeights ? [Math.floor(Math.min(...weightValues)) - 1, Math.ceil(Math.max(...weightValues)) + 1] : [0, 100]

  // The "+ Novo" button adds a food to the meal that fits the time of day.
  const hour = inTz(new Date(nowIso), SP_TIMEZONE).getHours()
  const nextMeal: MealKind = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : "dinner"
  usePrimaryAction("Adicionar alimento", () => setAdding(nextMeal))

  const tabs = (
    <PillTabs equal={isMobile} className={isMobile ? "grid-cols-3" : "w-fit max-w-full"} ariaLabel="Dieta" items={TAB_ITEMS} value={tab} onSelect={(item) => setTab(item.id as TabId)} />
  )
  const dayNav =
    tab === "hoje" ? (
      <div data-testid="diet-day-nav" className="flex h-10 items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Dia anterior" className="shrink-0" onClick={() => setDay((d) => shiftDay(d, -1))}>
          <ChevronLeftIcon strokeWidth={1.75} />
        </Button>
        <button type="button" data-testid="diet-day-label" aria-label="Ir para hoje" title="Ir para hoje" onClick={() => setDay(today)} className="min-w-0 rounded-full px-2 text-[15px] leading-6 font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {WEEKDAY_NAMES[parseISO(day).getDay()]}, {format(parseISO(day), "d 'de' MMMM", { locale: ptBR })}
        </button>
        <Button variant="ghost" size="icon" aria-label="Próximo dia" className="shrink-0" disabled={day >= today} onClick={() => setDay((d) => (d >= today ? d : shiftDay(d, 1)))}>
          <ChevronRightIcon strokeWidth={1.75} />
        </Button>
      </div>
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
                  <DropdownMenuItem onSelect={() => setWeighing(true)}>
                    <PlusIcon strokeWidth={1.75} /> Registrar peso
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
          <Bento>
          <KpiCard tone="highlight" label="Média diária" value={`${averageKcal}`} support="kcal" className="col-span-12 @min-[560px]:col-span-4" />
          <KpiCard label="Dias na meta" value={`${hitDays}`} support={`de ${kcalSeries.length}`} className="col-span-6 @min-[560px]:col-span-4" />
          <KpiCard label="Meta" value={`${goal.kcal}`} support="kcal por dia" className="col-span-6 @min-[560px]:col-span-4" />
          <BentoCard title="Calorias nos últimos 15 dias" className="col-span-12">
          <ChartContainer config={kcalConfig} className="aspect-auto h-72 w-full @min-[900px]:h-96">
            <BarChart data={kcalSeries} margin={{ left: -8, right: 4 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={1} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={goal.kcal} stroke="var(--foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Bar dataKey="kcal" fill="var(--color-kcal)" radius={6} />
            </BarChart>
          </ChartContainer>
          </BentoCard>
          </Bento>
      ) : null}

      {tab === "peso" ? (
          <Bento>
          <KpiCard tone="highlight" label="Peso atual" value={`${currentWeight.toLocaleString("pt-BR")} kg`} support="último registro" className="col-span-12 @min-[560px]:col-span-4" />
          <KpiCard
            label="Variação"
            value={`${Math.abs(Math.round((currentWeight - firstWeight) * 10) / 10).toLocaleString("pt-BR")} kg`}
            trend={currentWeight <= firstWeight ? "down" : "up"}
            support={period === "30" ? "em 30 dias" : period === "90" ? "em 90 dias" : "no último ano"}
            className="col-span-6 @min-[560px]:col-span-4"
          />
          <KpiCard
            label="Meta"
            value={target === null ? "—" : `${target} kg`}
            support={target === null ? "sem meta definida" : `faltam ${Math.max(0, Math.round((currentWeight - target) * 10) / 10).toLocaleString("pt-BR")} kg`}
            className="col-span-6 @min-[560px]:col-span-4"
          />
          <BentoCard
            title="Evolução do peso"
            className="col-span-12"
            actions={
              <Button variant="outline" size="sm" onClick={() => setWeighing(true)}>
                <PlusIcon strokeWidth={1.75} /> Registrar peso
              </Button>
            }
          >
          <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && setPeriod(v)} aria-label="Período" className="mb-4">
            <ToggleGroupItem value="30">30 dias</ToggleGroupItem>
            <ToggleGroupItem value="90">90 dias</ToggleGroupItem>
            <ToggleGroupItem value="365">1 ano</ToggleGroupItem>
          </ToggleGroup>
          <ChartContainer config={weightConfig} className="aspect-auto h-72 w-full @min-[900px]:h-96">
            <LineChart data={weightSeries} margin={{ left: -8, right: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} domain={weightDomain} allowDecimals={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toLocaleString("pt-BR")} kg`} />} />
              {target === null ? null : <ReferenceLine y={target} label={{ value: "Meta", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />}
              <Line dataKey="weight" type="monotone" stroke="var(--color-weight)" strokeWidth={1.75} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
          </BentoCard>
          </Bento>
      ) : null}

      <FoodSearchDialog meal={adding} onClose={() => setAdding(null)} onAdd={addItem} />
      <EditItemDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(id, servings) => setItems((current) => current.map((i) => (i.id === id ? { ...i, servings } : i)))}
        onRemove={(id) => {
          setItems((current) => current.filter((i) => i.id !== id))
          toast("Alimento removido.")
        }}
      />
      <WeightDialog
        open={weighing}
        onOpenChange={setWeighing}
        initial={currentWeight}
        onSave={(kg) => {
          // A second weigh-in on the same day replaces the first instead of adding a duplicate point.
          setWeights((current) => {
            const existing = current.find((w) => w.log_date === today)
            if (existing) return current.map((w) => (w === existing ? { ...w, weight_kg: kg } : w))
            return [...current, { id: newId(), user_id: "00000000-0000-4000-8000-000000000001", log_date: today, weight_kg: kg }]
          })
          toast.success("Peso registrado.")
        }}
      />
    </div>
  )
}

function FoodSearchDialog({
  meal,
  onClose,
  onAdd,
}: {
  meal: MealKind | null
  onClose: () => void
  onAdd: (meal: MealKind, foodId: string, servings: number) => void
}) {
  return (
    <Dialog open={Boolean(meal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{meal ? <FoodSearchBody meal={meal} onAdd={onAdd} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  )
}

function FoodSearchBody({
  meal,
  onAdd,
  onClose,
}: {
  meal: MealKind
  onAdd: (meal: MealKind, foodId: string, servings: number) => void
  onClose: () => void
}) {
  const foods = useFoods()
  const [chosen, setChosen] = useState<FoodRow | null>(null)
  const [servings, setServings] = useState("1")

  if (chosen) {
    const amount = Number(servings.replace(",", ".")) || 0
    const macros = itemMacros({ servings: amount }, chosen)
    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (amount <= 0) return
          onAdd(meal, chosen.id, amount)
          onClose()
        }}
      >
        <DialogHeader>
          <DialogTitle>{chosen.name}</DialogTitle>
          <DialogDescription>
            Porção: {chosen.serving_label} · {MEAL_LABELS[meal]}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="servings">Quantidade de porções</Label>
          <Input id="servings" autoFocus inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
          <p className="tabular text-[13px] leading-5 text-muted-foreground">
            {macros.kcal} kcal · P {macros.protein} g · C {macros.carbs} g · G {macros.fat} g
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setChosen(null)}>
            Voltar
          </Button>
          <Button type="submit" disabled={amount <= 0}>
            Adicionar
          </Button>
        </DialogFooter>
      </form>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adicionar em {MEAL_LABELS[meal].toLowerCase()}</DialogTitle>
        <DialogDescription>Busque no banco de alimentos.</DialogDescription>
      </DialogHeader>
      <Command className="rounded-xl border border-border">
        <CommandInput placeholder="Buscar alimento" autoFocus />
        <CommandList className="max-h-72">
          <CommandEmpty>Nenhum alimento encontrado.</CommandEmpty>
          <CommandGroup>
            {foods.map((f) => (
              <CommandItem key={f.id} value={f.name} onSelect={() => setChosen(f)}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{f.name}</span>
                  <span className="truncate text-[13px] leading-5 text-muted-foreground">{f.serving_label}</span>
                </span>
                <span className="tabular text-[13px] text-muted-foreground">{f.kcal} kcal</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </>
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

function WeightDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: number
  onSave: (kg: number) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <WeightForm initial={initial} onSave={onSave} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function WeightForm({ initial, onSave, onClose }: { initial: number; onSave: (kg: number) => void; onClose: () => void }) {
  const [value, setValue] = useState(String(initial).replace(".", ","))
  const kg = Number(value.replace(",", "."))
  const valid = Number.isFinite(kg) && kg > 20 && kg < 400

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave(Math.round(kg * 10) / 10)
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Registrar peso</DialogTitle>
        <DialogDescription className="sr-only">Informe seu peso de hoje em quilos.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="weight">Peso (kg)</Label>
        <Input id="weight" autoFocus inputMode="decimal" value={value} aria-invalid={!valid} onChange={(e) => setValue(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
