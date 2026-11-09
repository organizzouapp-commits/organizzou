"use client"

import { useEffect, useState } from "react"
import { CopyIcon, DropletsIcon, EllipsisIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { BentoCard } from "@/components/finance/bento"
import { FinanceDeck } from "@/components/finance/finance-deck"
import { AddPill, HatchedProgress, HeroCard, LIST_CARD } from "@/components/finance/parts"
import { HATCH_STYLE } from "@/components/habits/hoje-tab"
import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { localMealGroupRepo } from "@/features/diet/meal-groups"
import { formatServings, itemMacros, mealTotals, type Macros } from "@/features/diet/stats"
import { filledPips, kcalText, litersText, macroPercent, remainingKcal, waterPips } from "@/features/diet/summary"
import { MEAL_LABELS, type DietGoalRow, type FoodRow, type MealItemRow, type MealKind } from "@/features/diet/types"
import { cn } from "@/lib/utils"

const MEALS = Object.keys(MEAL_LABELS) as MealKind[]
const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

// ------------------------------------------------------------------ summary row

export function SummaryRow({ isMobile, totals, goal, water, glassMl, onAddWater, onRemoveWater }: { isMobile: boolean; totals: Macros; goal: DietGoalRow; water: number; glassMl: number; onAddWater: () => void; onRemoveWater: () => void }) {
  const left = remainingKcal(totals.kcal, goal.kcal)
  const height = isMobile ? undefined : "h-[216px]"
  const macros = [
    { label: "Proteína", value: totals.protein, goal: goal.protein_g },
    { label: "Carboidrato", value: totals.carbs, goal: goal.carbs_g },
    { label: "Gordura", value: totals.fat, goal: goal.fat_g },
  ]
  const pips = waterPips(goal.water_ml)
  const filled = filledPips(water, goal.water_ml)

  const hero = (
    <HeroCard
      key="hero"
      className={height}
      density={isMobile ? "default" : "dense"}
      label="Calorias de hoje"
      value={
        <>
          {kcalText(left.value)}
          <span className="ml-1.5 text-[16px] leading-6 font-medium tracking-normal opacity-60">{left.over ? "kcal acima" : "kcal restam"}</span>
        </>
      }
      support={`${kcalText(totals.kcal)} de ${kcalText(goal.kcal)} kcal consumidas`}
      progress={{ value: macroPercent(totals.kcal, goal.kcal), label: "Calorias consumidas do dia" }}
    />
  )
  const macrosCard = (
    <BentoCard key="macros" title="Macros" data-testid="diet-macros" className={cn(height, "md:gap-2 md:p-4")} actions={<span data-chip className={chip}>meta do dia</span>}>
      <ul className="flex flex-col gap-3">
        {macros.map((m) => (
          <li key={m.label} className="flex flex-col gap-1.5">
            <div className="tabular flex items-baseline justify-between gap-2 text-[13px] leading-5">
              <span>{m.label}</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground">{Math.round(m.value)}</span> / {m.goal} g
              </span>
            </div>
            <HatchedProgress value={macroPercent(m.value, m.goal)} label={`${m.label} do dia`} />
          </li>
        ))}
      </ul>
    </BentoCard>
  )
  const waterCard = (
    <BentoCard key="water" title="Água" data-testid="diet-water" className={cn(height, "md:p-4")} actions={<span data-chip className={chip}>meta: {litersText(goal.water_ml)} L</span>}>
      <div className="flex flex-col gap-3">
        <p className="tabular flex items-baseline gap-1.5 text-[30px] leading-9 font-semibold tracking-[-0.02em]">
          {litersText(water)}
          <span className="text-[13px] leading-5 font-normal text-muted-foreground">L de {litersText(goal.water_ml)} L</span>
        </p>
        <div role="img" aria-label={`Água: ${litersText(water)} de ${litersText(goal.water_ml)} litros`} data-testid="water-pips" className="flex gap-1">
          {Array.from({ length: pips.count }, (_, i) => (
            <span key={i} data-pip={i < filled ? "on" : "off"} className={cn("h-2.5 min-w-0 flex-1 rounded-full", i < filled ? "bg-primary" : "border border-foreground/20")} style={i < filled ? undefined : HATCH_STYLE} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={`Remover ${glassMl} ml`} disabled={water <= 0} onClick={onRemoveWater} className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border outline-none transition-colors duration-[400ms] after:absolute after:-inset-0.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none">
            <MinusIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
          <button type="button" data-testid="add-water" onClick={onAddWater} className="relative inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-highlight px-3 text-[14px] leading-5 font-semibold text-highlight-foreground outline-none transition-colors duration-[400ms] after:absolute after:-inset-0.5 hover:bg-highlight/90 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
            <DropletsIcon aria-hidden strokeWidth={1.75} className="size-4" /> + {glassMl} ml
          </button>
        </div>
      </div>
    </BentoCard>
  )

  if (isMobile) {
    return (
      <FinanceDeck
        title={null}
        label="Resumo do dia"
        noun="resumo"
        initialHeight={216}
        slides={[
          { id: "hero", hero: true, node: hero },
          { id: "macros", node: macrosCard },
          { id: "water", node: waterCard },
        ]}
      />
    )
  }
  return (
    <div data-testid="diet-summary" className="grid grid-cols-12 gap-4">
      <div className="col-span-4 flex min-w-0 flex-col [&>*]:flex-1">{hero}</div>
      <div className="col-span-5 min-w-0">{macrosCard}</div>
      <div className="col-span-3 min-w-0">{waterCard}</div>
    </div>
  )
}

// ------------------------------------------------------------------ meals

function useMealGroups() {
  const [state, setState] = useState<Partial<Record<MealKind, boolean>>>({})
  useEffect(() => {
    // localStorage only exists in the browser; read after mount so the server and the first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(localMealGroupRepo.load())
  }, [])
  const isOpen = (meal: MealKind) => state[meal] ?? true
  const toggle = (meal: MealKind) =>
    setState((current) => {
      const next = { ...current, [meal]: !(current[meal] ?? true) }
      localMealGroupRepo.save(next)
      return next
    })
  return { isOpen, toggle }
}

function FoodCard({ entry, food, onEdit, onRemove, onMove }: { entry: MealItemRow; food: FoodRow; onEdit: () => void; onRemove: () => void; onMove: (meal: MealKind) => void }) {
  const macros = itemMacros(entry, food)
  return (
    <li data-food={entry.id} className={cn(LIST_CARD, "flex items-center gap-1 p-1 pl-3")}>
      <button type="button" onClick={onEdit} aria-label={`Editar porção de ${food.name}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[12px] py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-5 font-semibold">{food.name}</span>
          <span className="tabular block truncate text-[13px] leading-5 text-muted-foreground">
            {formatServings(entry.servings)} × {food.serving_label} · P {macros.protein.toLocaleString("pt-BR")} g · C {macros.carbs.toLocaleString("pt-BR")} g · G {macros.fat.toLocaleString("pt-BR")} g
          </span>
        </span>
        <span className="tabular shrink-0 text-[15px] leading-5 font-semibold">{macros.kcal} kcal</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Opções de ${food.name}`} className="relative size-9 shrink-0 rounded-full after:absolute after:-inset-1">
            <EllipsisIcon strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Editar porção</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Mover para…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {MEALS.filter((m) => m !== entry.meal).map((m) => (
                <DropdownMenuItem key={m} onSelect={() => onMove(m)}>
                  {MEAL_LABELS[m]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2Icon strokeWidth={1.75} /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function MealGroup({ meal, items, foods, open, onToggle, onAdd, onEdit, onRemove, onMove, onCopy, onClear }: {
  meal: MealKind
  items: MealItemRow[]
  foods: FoodRow[]
  open: boolean
  onToggle: () => void
  onAdd: () => void
  onEdit: (entry: MealItemRow) => void
  onRemove: (entry: MealItemRow) => void
  onMove: (entry: MealItemRow, to: MealKind) => void
  onCopy: (to: MealKind) => void
  onClear: () => void
}) {
  const list = items.filter((i) => i.meal === meal)
  const subtotal = mealTotals(items, foods, meal)
  return (
    <section data-meal={meal} aria-label={MEAL_LABELS[meal]} className="flex flex-col">
      <div className="flex items-center gap-2">
        <GroupHeader label={MEAL_LABELS[meal]} open={open} onToggle={onToggle} />
        <span data-chip className={chip}>
          {kcalText(subtotal.kcal)} kcal
        </span>
        <span className="ml-auto flex items-center">
          <button type="button" aria-label={`Adicionar alimento em ${MEAL_LABELS[meal].toLowerCase()}`} onClick={onAdd} className="relative flex size-9 items-center justify-center rounded-full outline-none after:absolute after:-inset-y-1 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
            <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Opções de ${MEAL_LABELS[meal]}`} className="relative size-9 rounded-full after:absolute after:-inset-y-1">
                <EllipsisIcon strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Duplicar para…</DropdownMenuLabel>
              {MEALS.filter((m) => m !== meal).map((target) => (
                <DropdownMenuItem key={target} disabled={list.length === 0} onSelect={() => onCopy(target)}>
                  <CopyIcon strokeWidth={1.75} /> {MEAL_LABELS[target]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={list.length === 0} onSelect={onClear}>
                <Trash2Icon strokeWidth={1.75} /> Limpar refeição
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      <Collapse open={open}>
        <ul className="flex flex-col gap-2 pb-2">
          {list.map((entry) => {
            const food = foods.find((f) => f.id === entry.food_id)
            return food ? <FoodCard key={entry.id} entry={entry} food={food} onEdit={() => onEdit(entry)} onRemove={() => onRemove(entry)} onMove={(to) => onMove(entry, to)} /> : null
          })}
        </ul>
        <AddPill label="Adicionar alimento" onClick={onAdd} className={cn("mb-2", list.length === 0 ? "h-11 md:h-11" : "h-10 md:h-10")} />
      </Collapse>
    </section>
  )
}

/** Four meals: two columns on a wide screen (breakfast + lunch, snack + dinner), one column on a phone. */
export function Meals({ items, foods, onAdd, onEdit, onRemove, onMove, onCopy, onClear }: {
  items: MealItemRow[]
  foods: FoodRow[]
  onAdd: (meal: MealKind) => void
  onEdit: (entry: MealItemRow) => void
  onRemove: (entry: MealItemRow) => void
  onMove: (entry: MealItemRow, to: MealKind) => void
  onCopy: (from: MealKind, to: MealKind) => void
  onClear: (meal: MealKind) => void
}) {
  const groups = useMealGroups()
  const group = (meal: MealKind) => (
    <MealGroup key={meal} meal={meal} items={items} foods={foods} open={groups.isOpen(meal)} onToggle={() => groups.toggle(meal)} onAdd={() => onAdd(meal)} onEdit={onEdit} onRemove={onRemove} onMove={onMove} onCopy={(to) => onCopy(meal, to)} onClear={() => onClear(meal)} />
  )
  return (
    <div data-testid="diet-meals" className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 @min-[880px]:grid-cols-2 @min-[880px]:items-start">
      <div className="flex min-w-0 flex-col gap-1">{(["breakfast", "lunch"] as MealKind[]).map(group)}</div>
      <div className="flex min-w-0 flex-col gap-1">{(["snack", "dinner"] as MealKind[]).map(group)}</div>
    </div>
  )
}
