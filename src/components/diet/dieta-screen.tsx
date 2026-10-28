"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { CopyIcon, EllipsisIcon, GlassWaterIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { shiftDay } from "@/features/habits/stats"
import { dayTotals, formatServings, itemMacros, mealTotals } from "@/features/diet/stats"
import { MEAL_LABELS, type FoodRow, type MealItemRow, type MealKind, type WeightLogRow } from "@/features/diet/types"
import {
  buildMockDailyKcal,
  buildMockMealItems,
  buildMockWeight,
  mockDietGoal,
  mockFoods,
} from "@/mocks/diet"
import { inTz } from "@/lib/dates"
import { dayOf, MOCK_TIMEZONE, mockId } from "@/mocks/time"

const MEALS = Object.keys(MEAL_LABELS) as MealKind[]
const GLASS_ML = 250

const kcalConfig = { kcal: { label: "Calorias", color: "var(--chart-1)" } } satisfies ChartConfig
const weightConfig = { weight: { label: "Peso (kg)", color: "var(--chart-1)" } } satisfies ChartConfig

function findFood(id: string): FoodRow | undefined {
  return mockFoods.find((f) => f.id === id)
}

/** Calories ring: remaining kcal in the middle; the arc is foreground (Tinta/Papel), never a thin Lima line. */
function CalorieRing({ eaten, goal }: { eaten: number; goal: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const ratio = Math.min(1, eaten / goal)
  const remaining = goal - eaten
  return (
    <div role="img" aria-label={`${eaten} de ${goal} kcal`} className="relative size-40 shrink-0">
      <svg viewBox="0 0 128 128" className="size-40 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" strokeLinecap="round" className="stroke-foreground" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[30px] leading-9 font-semibold tracking-[-0.02em]">{Math.abs(remaining)}</span>
        <span className="text-[13px] leading-5 text-muted-foreground">kcal {remaining >= 0 ? "restam" : "acima"}</span>
      </span>
    </div>
  )
}

function liters(ml: number) {
  return `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`
}

export function DietaScreen({ nowIso }: { nowIso: string }) {
  const today = dayOf(nowIso)
  const goal = mockDietGoal
  const [items, setItems] = useState<MealItemRow[]>(() => buildMockMealItems())
  const [water, setWater] = useState(1250)
  const [weights, setWeights] = useState<WeightLogRow[]>(() => buildMockWeight(nowIso))
  const [adding, setAdding] = useState<MealKind | null>(null)
  const [editing, setEditing] = useState<MealItemRow | null>(null)
  const [weighing, setWeighing] = useState(false)
  const [period, setPeriod] = useState("90")
  const history = buildMockDailyKcal(nowIso)

  const totals = dayTotals(items, mockFoods)

  function addItem(meal: MealKind, foodId: string, servings: number) {
    setItems((current) => [...current, { id: mockId("item"), meal, food_id: foodId, servings }])
    toast.success("Alimento adicionado.")
  }

  function copyMeal(from: MealKind, to: MealKind) {
    const source = items.filter((i) => i.meal === from)
    setItems((current) => [...current, ...source.map((i) => ({ ...i, id: mockId("item"), meal: to }))])
    toast.success(`${MEAL_LABELS[from]} copiado para ${MEAL_LABELS[to].toLowerCase()}.`)
  }

  const macroRows = [
    { label: "Proteína", value: totals.protein, goal: goal.protein_g },
    { label: "Carboidrato", value: totals.carbs, goal: goal.carbs_g },
    { label: "Gordura", value: totals.fat, goal: goal.fat_g },
  ]

  const kcalSeries = [
    ...history.map((h) => ({ label: format(parseISO(h.day), "dd/MM"), kcal: h.kcal })),
    { label: "Hoje", kcal: totals.kcal },
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
  const weightValues = [...periodWeights.map((w) => w.weight_kg), goal.target_weight_kg]
  const weightDomain: [number, number] = [Math.floor(Math.min(...weightValues)) - 1, Math.ceil(Math.max(...weightValues)) + 1]

  // The "+ Novo" button adds a food to the meal that fits the time of day.
  const hour = inTz(new Date(nowIso), MOCK_TIMEZONE).getHours()
  const nextMeal: MealKind = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : hour < 18 ? "snack" : "dinner"
  usePrimaryAction("Adicionar alimento", () => setAdding(nextMeal))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader />

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="peso">Peso</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="pt-5">
          <div className="@container flex flex-col gap-5">
            <div className="grid gap-5 @min-[900px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <BentoCard title="Calorias e macros" bodyClassName="flex flex-col items-center gap-6 @min-[560px]:flex-row">
                <CalorieRing eaten={totals.kcal} goal={goal.kcal} />
                <div className="grid w-full min-w-0 flex-1 gap-4">
                  {macroRows.map((m) => (
                    <div key={m.label} className="flex flex-col gap-2">
                      <div className="tabular flex justify-between text-[13px] leading-5">
                        <span>{m.label}</span>
                        <span className="text-muted-foreground">
                          {Math.round(m.value)} / {m.goal} g
                        </span>
                      </div>
                      <Progress value={Math.min(100, (m.value / m.goal) * 100)} aria-label={`${m.label} do dia`} />
                    </div>
                  ))}
                </div>
              </BentoCard>

              <BentoCard title="Água" bodyClassName="flex h-full flex-col justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="tabular text-[34px] leading-10 font-semibold tracking-[-0.02em]">{liters(water)}</span>
                  <span className="tabular text-[13px] leading-5 text-muted-foreground">de {liters(goal.water_ml)} hoje</span>
                </div>
                <Progress value={Math.min(100, (water / goal.water_ml) * 100)} aria-label="Água do dia" />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" aria-label="Remover um copo" disabled={water <= 0} onClick={() => setWater((w) => Math.max(0, w - GLASS_ML))}>
                    <MinusIcon strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setWater((w) => w + GLASS_ML)
                      if (water + GLASS_ML >= goal.water_ml && water < goal.water_ml) toast.success("Meta de água batida.")
                    }}
                  >
                    <GlassWaterIcon strokeWidth={1.75} /> + 250 ml
                  </Button>
                </div>
              </BentoCard>
            </div>

            <div className="grid gap-5 @min-[900px]:grid-cols-2 @min-[1400px]:grid-cols-3">
            {MEALS.map((meal) => {
              const list = items.filter((i) => i.meal === meal)
              const subtotal = mealTotals(items, mockFoods, meal)
              return (
                <BentoCard
                  key={meal}
                  title={MEAL_LABELS[meal]}
                  actions={
                    <>
                    <span className="tabular text-[13px] leading-5 text-muted-foreground">{subtotal.kcal} kcal</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Opções de ${MEAL_LABELS[meal]}`}>
                          <EllipsisIcon strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Duplicar para…</DropdownMenuLabel>
                        {MEALS.filter((m) => m !== meal).map((target) => (
                          <DropdownMenuItem key={target} disabled={list.length === 0} onSelect={() => copyMeal(meal, target)}>
                            <CopyIcon strokeWidth={1.75} /> {MEAL_LABELS[target]}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={list.length === 0}
                          onSelect={() => {
                            setItems((current) => current.filter((i) => i.meal !== meal))
                            toast(`${MEAL_LABELS[meal]} limpo.`)
                          }}
                        >
                          <Trash2Icon strokeWidth={1.75} /> Limpar refeição
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </>
                  }
                >
                  {list.map((entry) => {
                    const foodRow = findFood(entry.food_id)
                    if (!foodRow) return null
                    const macros = itemMacros(entry, foodRow)
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setEditing(entry)}
                        className="flex min-h-14 w-full items-center gap-4 border-b border-border py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] leading-6">{foodRow.name}</span>
                          <span className="tabular truncate text-[13px] leading-5 text-muted-foreground">
                            {formatServings(entry.servings)} × {foodRow.serving_label} · P {macros.protein} g · C {macros.carbs} g · G {macros.fat} g
                          </span>
                        </span>
                        <span className="tabular text-[15px]">{macros.kcal} kcal</span>
                      </button>
                    )
                  })}
                  <div className="pt-2">
                    <Button variant="ghost" className="justify-start text-muted-foreground" onClick={() => setAdding(meal)}>
                      <PlusIcon strokeWidth={1.75} /> Adicionar alimento
                    </Button>
                  </div>
                </BentoCard>
              )
            })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="pt-5">
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
        </TabsContent>

        <TabsContent value="peso" className="pt-5">
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
            value={`${goal.target_weight_kg} kg`}
            support={`faltam ${Math.max(0, Math.round((currentWeight - goal.target_weight_kg) * 10) / 10).toLocaleString("pt-BR")} kg`}
            className="col-span-6 @min-[560px]:col-span-4"
          />
          <BentoCard
            title="Evolução do peso"
            className="col-span-12"
            actions={
              <>
                <ToggleGroup type="single" variant="outline" size="sm" value={period} onValueChange={(v) => v && setPeriod(v)} aria-label="Período">
                  <ToggleGroupItem value="30">30 dias</ToggleGroupItem>
                  <ToggleGroupItem value="90">90 dias</ToggleGroupItem>
                  <ToggleGroupItem value="365">1 ano</ToggleGroupItem>
                </ToggleGroup>
                <Button variant="outline" size="sm" onClick={() => setWeighing(true)}>
                  <PlusIcon strokeWidth={1.75} /> Registrar peso
                </Button>
              </>
            }
          >
          <ChartContainer config={weightConfig} className="aspect-auto h-72 w-full @min-[900px]:h-96">
            <LineChart data={weightSeries} margin={{ left: -8, right: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} domain={weightDomain} allowDecimals={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toLocaleString("pt-BR")} kg`} />} />
              <ReferenceLine y={goal.target_weight_kg} label={{ value: "Meta", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line dataKey="weight" type="monotone" stroke="var(--color-weight)" strokeWidth={1.75} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
          </BentoCard>
          </Bento>
        </TabsContent>
      </Tabs>

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
          setWeights((current) => [...current.filter((w) => w.log_date !== today), { id: mockId("w"), user_id: "00000000-0000-4000-8000-000000000001", log_date: today, weight_kg: kg }])
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
            {mockFoods.map((f) => (
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
  const food = findFood(item.food_id)
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
