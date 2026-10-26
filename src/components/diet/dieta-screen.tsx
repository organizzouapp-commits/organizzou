"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CopyIcon, EllipsisIcon, GlassWaterIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { PageHeader, SectionTitle } from "@/components/organizzou/PageHeader"
import { Stat } from "@/components/organizzou/Stat"
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
import { dayTotals, formatServings, itemMacros, mealTotals } from "@/features/diet/stats"
import { MEAL_LABELS, type FoodRow, type MealItemRow, type MealKind, type WeightLogRow } from "@/features/diet/types"
import {
  buildMockDailyKcal,
  buildMockMealItems,
  buildMockWeight,
  mockDietGoal,
  mockFoods,
} from "@/mocks/diet"
import { dayOf, mockId } from "@/mocks/time"

const MEALS = Object.keys(MEAL_LABELS) as MealKind[]
const GLASS_ML = 250

const kcalConfig = { kcal: { label: "Calorias", color: "var(--chart-1)" } } satisfies ChartConfig
const weightConfig = { weight: { label: "Peso (kg)", color: "var(--chart-1)" } } satisfies ChartConfig

function findFood(id: string): FoodRow | undefined {
  return mockFoods.find((f) => f.id === id)
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
  const history = buildMockDailyKcal(nowIso)

  const totals = dayTotals(items, mockFoods)
  const remaining = goal.kcal - totals.kcal

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
  const weightSeries = weights.map((w) => ({ label: format(parseISO(w.log_date), "dd/MM"), weight: w.weight_kg }))
  const currentWeight = weights[weights.length - 1]?.weight_kg ?? 0
  const firstWeight = weights[0]?.weight_kg ?? currentWeight

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dieta"
        description={format(parseISO(today), "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}
      />

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="peso">Peso</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="flex flex-col gap-10 pt-6">
          <section className="flex max-w-2xl flex-col gap-6">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Consumido" value={`${totals.kcal}`} support="kcal" />
              <Stat label="Meta" value={`${goal.kcal}`} support="kcal" />
              <Stat label={remaining >= 0 ? "Restam" : "Acima"} value={`${Math.abs(remaining)}`} support="kcal" />
            </div>
            <Progress value={Math.min(100, (totals.kcal / goal.kcal) * 100)} aria-label="Calorias do dia" />
            <div className="grid gap-4 sm:grid-cols-3">
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
          </section>

          <section className="flex max-w-2xl flex-col gap-3">
            <SectionTitle>Água</SectionTitle>
            <div className="flex items-center justify-between gap-4">
              <span className="tabular text-[15px] leading-6">
                {liters(water)} <span className="text-muted-foreground">de {liters(goal.water_ml)}</span>
              </span>
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
            </div>
            <Progress value={Math.min(100, (water / goal.water_ml) * 100)} aria-label="Água do dia" />
          </section>

          <div className="flex max-w-2xl flex-col gap-10">
            {MEALS.map((meal) => {
              const list = items.filter((i) => i.meal === meal)
              const subtotal = mealTotals(items, mockFoods, meal)
              return (
                <section key={meal} className="flex flex-col">
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="flex-1 text-[17px] leading-6 font-semibold">{MEAL_LABELS[meal]}</h2>
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
                  </div>
                  {list.map((entry) => {
                    const foodRow = findFood(entry.food_id)
                    if (!foodRow) return null
                    const macros = itemMacros(entry, foodRow)
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setEditing(entry)}
                        className="flex min-h-14 items-center gap-4 border-b border-border py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
                </section>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="flex flex-col gap-8 pt-6">
          <div className="grid grid-cols-3 gap-4 max-w-xl">
            <Stat size="sm" label="Média diária" value={`${averageKcal}`} support="kcal" />
            <Stat size="sm" label="Dias na meta" value={`${hitDays}`} support={`de ${kcalSeries.length}`} />
            <Stat size="sm" label="Meta" value={`${goal.kcal}`} support="kcal" />
          </div>
          <ChartContainer config={kcalConfig} className="aspect-[16/8] w-full max-w-3xl">
            <BarChart data={kcalSeries} margin={{ left: -8, right: 4 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={1} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={goal.kcal} stroke="var(--foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Bar dataKey="kcal" fill="var(--color-kcal)" radius={6} />
            </BarChart>
          </ChartContainer>
        </TabsContent>

        <TabsContent value="peso" className="flex flex-col gap-8 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid grid-cols-3 gap-6">
              <Stat size="sm" label="Peso atual" value={`${currentWeight.toLocaleString("pt-BR")} kg`} />
              <Stat
                size="sm"
                label="Variação"
                value={`${Math.abs(Math.round((currentWeight - firstWeight) * 10) / 10).toLocaleString("pt-BR")} kg`}
                trend={currentWeight <= firstWeight ? "down" : "up"}
                support="em 12 semanas"
              />
              <Stat size="sm" label="Meta" value={`${goal.target_weight_kg} kg`} support={`faltam ${Math.max(0, Math.round((currentWeight - goal.target_weight_kg) * 10) / 10).toLocaleString("pt-BR")} kg`} />
            </div>
            <Button variant="outline" onClick={() => setWeighing(true)}>
              <PlusIcon strokeWidth={1.75} /> Registrar peso
            </Button>
          </div>
          <ChartContainer config={weightConfig} className="aspect-[16/8] w-full max-w-3xl">
            <LineChart data={weightSeries} margin={{ left: -8, right: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={goal.target_weight_kg} stroke="var(--foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line dataKey="weight" type="monotone" stroke="var(--color-weight)" strokeWidth={1.75} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
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
          setWeights((current) => [...current, { id: mockId("w"), user_id: "00000000-0000-4000-8000-000000000001", log_date: today, weight_kg: kg }])
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
