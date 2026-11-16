"use client"

import { useEffect, useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, CookieIcon, CoffeeIcon, DumbbellIcon, EllipsisIcon, GripVerticalIcon, MoonIcon, PencilIcon, PlusIcon, SandwichIcon, Trash2Icon, UtensilsIcon, AppleIcon, type LucideIcon } from "lucide-react"

import { AddPill, LIST_CARD } from "@/components/finance/parts"
import { Collapse, GroupHeader } from "@/components/organizzou/Group"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatServings, itemMacros, mealTotals } from "@/features/diet/stats"
import { kcalText } from "@/features/diet/summary"
import { MAX_MEALS, MEAL_ICON_KEYS, MEAL_NAME_MAX, mealIdOf, validateMealName, type MealDef, type MealIconKey, type MealInput, type MealLayout } from "@/features/diet/meals"
import type { FoodRow, MealItemRow } from "@/features/diet/types"
import { cn } from "@/lib/utils"

const MEAL_ICONS: Record<MealIconKey, { icon: LucideIcon; label: string }> = {
  utensils: { icon: UtensilsIcon, label: "Prato" },
  coffee: { icon: CoffeeIcon, label: "Café" },
  apple: { icon: AppleIcon, label: "Fruta" },
  sandwich: { icon: SandwichIcon, label: "Sanduíche" },
  cookie: { icon: CookieIcon, label: "Biscoito" },
  moon: { icon: MoonIcon, label: "Noite" },
  dumbbell: { icon: DumbbellIcon, label: "Treino" },
}

const chip = "tabular inline-flex h-6 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"
const GROUPS_KEY = "organizzou:dieta-meal-open"

/** Which meals are collapsed (by meal id), remembered on this device. */
function useOpenState() {
  const [state, setState] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}") as Record<string, boolean>)
    } catch {
      // Nothing saved.
    }
  }, [])
  return {
    isOpen: (id: string) => state[id] ?? true,
    toggle: (id: string) =>
      setState((current) => {
        const next = { ...current, [id]: !(current[id] ?? true) }
        try {
          localStorage.setItem(GROUPS_KEY, JSON.stringify(next))
        } catch {
          // Private mode.
        }
        return next
      }),
  }
}

type Handlers = {
  onEdit: (entry: MealItemRow) => void
  onRemove: (entry: MealItemRow) => void
  /** Puts a food in a meal at a place (index among that meal's other foods; undefined = the end). */
  onPlace: (entryId: string, toMealId: string, index?: number) => void
}

function FoodRow({ entry, food, meals, currentMeal, handlers }: { entry: MealItemRow; food: FoodRow; meals: MealDef[]; currentMeal: string; handlers: Handlers }) {
  const macros = itemMacros(entry, food)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-food={entry.id} {...listeners} className={cn(LIST_CARD, "relative flex touch-pan-y items-center gap-1 p-1 pl-1", isDragging && "z-10 opacity-80 ring-2 ring-ring")}>
      <button type="button" {...attributes} {...listeners} aria-label={`Reordenar ${food.name}`} data-testid="food-grip" className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <GripVerticalIcon aria-hidden strokeWidth={1.75} className="size-4" />
      </button>
      <button type="button" onClick={() => handlers.onEdit(entry)} aria-label={`Editar porção de ${food.name}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[12px] py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
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
          <DropdownMenuItem onSelect={() => handlers.onEdit(entry)}>Editar porção</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Mover para…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {meals
                .filter((m) => m.id !== currentMeal)
                .map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => handlers.onPlace(entry.id, m.id)}>
                    {m.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => handlers.onRemove(entry)}>
            <Trash2Icon strokeWidth={1.75} /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function MealSection({ meal, index, count, entries, allItems, foods, layout, open, onToggle, handlers, actions }: { meal: MealDef; index: number; count: number; entries: MealItemRow[]; allItems: MealItemRow[]; foods: FoodRow[]; layout: MealLayout; open: boolean; onToggle: () => void; handlers: Handlers; actions: MealActions }) {
  const { setNodeRef, isOver } = useDroppable({ id: `meal:${meal.id}` })
  const subtotal = mealTotals(allItems.map((i) => ({ ...i, meal: mealIdOf(i, layout) })), foods, meal.id)
  const Icon = meal.icon ? MEAL_ICONS[meal.icon].icon : null
  return (
    <section data-meal={meal.id} aria-label={meal.name} className="flex flex-col">
      <div className="flex items-center gap-2">
        <GroupHeader label={meal.name} open={open} onToggle={onToggle} />
        {Icon ? <Icon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" /> : null}
        {meal.time ? <span className={chip}>{meal.time}</span> : null}
        <span data-chip className={chip}>
          {kcalText(subtotal.kcal)} kcal
        </span>
        <span className="ml-auto flex items-center">
          <button type="button" aria-label={`Adicionar alimento em ${meal.name.toLowerCase()}`} onClick={() => actions.onAdd(meal.id)} className="relative flex size-9 items-center justify-center rounded-full outline-none after:absolute after:-inset-1 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
            <PlusIcon aria-hidden strokeWidth={1.75} className="size-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Opções de ${meal.name}`} className="relative size-9 rounded-full after:absolute after:-inset-y-1">
                <EllipsisIcon strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => actions.onEditMeal(meal)}>
                <PencilIcon strokeWidth={1.75} /> Renomear ou editar
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === 0} onSelect={() => actions.onMoveMeal(meal.id, -1)}>
                <ArrowUpIcon strokeWidth={1.75} /> Mover para cima
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === count - 1} onSelect={() => actions.onMoveMeal(meal.id, 1)}>
                <ArrowDownIcon strokeWidth={1.75} /> Mover para baixo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Duplicar para…</DropdownMenuLabel>
              {layout.meals
                .filter((m) => m.id !== meal.id)
                .map((target) => (
                  <DropdownMenuItem key={target.id} disabled={entries.length === 0} onSelect={() => actions.onCopy(meal.id, target.id)}>
                    <CopyIcon strokeWidth={1.75} /> {target.name}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={entries.length === 0} onSelect={() => actions.onClear(meal.id)}>
                <Trash2Icon strokeWidth={1.75} /> Limpar refeição
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" disabled={count <= 1} onSelect={() => actions.onDeleteMeal(meal)}>
                <Trash2Icon strokeWidth={1.75} /> Excluir refeição
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      <Collapse open={open}>
        <div ref={setNodeRef} data-drop={meal.id} className={cn("rounded-[16px] transition-shadow duration-150 motion-reduce:transition-none", isOver && "ring-2 ring-ring/70")}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex min-h-2 flex-col gap-2 pb-2">
              {entries.map((entry) => {
                const food = foods.find((f) => f.id === entry.food_id)
                return food ? <FoodRow key={entry.id} entry={entry} food={food} meals={layout.meals} currentMeal={meal.id} handlers={handlers} /> : null
              })}
            </ul>
          </SortableContext>
        </div>
        <AddPill label="Adicionar alimento" onClick={() => actions.onAdd(meal.id)} className={cn("mb-2", entries.length === 0 ? "h-11 md:h-11" : "h-10 md:h-10")} />
      </Collapse>
    </section>
  )
}

export type MealActions = {
  onAdd: (mealId: string) => void
  onCopy: (from: string, to: string) => void
  onClear: (mealId: string) => void
  onEditMeal: (meal: MealDef) => void
  onMoveMeal: (mealId: string, direction: -1 | 1) => void
  onDeleteMeal: (meal: MealDef) => void
  onNewMeal: () => void
}

const ANNOUNCEMENTS = {
  onDragStart: () => "Alimento pego. Use as setas para escolher a refeição e a posição, e espaço para soltar.",
  onDragOver: () => "Movendo o alimento.",
  onDragEnd: () => "Alimento solto na nova posição.",
  onDragCancel: () => "Movimento cancelado.",
}

/**
 * The meals of the day: any number of meals (the person's own list), foods that move between meals by drag (a grip handle with the keyboard,
 * a long press on a phone) or by "Mover para…", highlighted drop targets and totals that follow at once. Two columns on a wide screen.
 */
export function MealsBoard({ layout, items, foods, handlers, actions }: { layout: MealLayout; items: MealItemRow[]; foods: FoodRow[]; handlers: Handlers; actions: MealActions }) {
  const open = useOpenState()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A long press (a quarter of a second) picks the food up on a phone; a plain swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const byMeal = (mealId: string) => items.filter((i) => mealIdOf(i, layout) === mealId)

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    if (!event.over) return
    const overId = String(event.over.id)
    const moving = items.find((i) => i.id === activeId)
    if (!moving) return
    const fromMeal = mealIdOf(moving, layout)
    if (overId.startsWith("meal:")) {
      const toMeal = overId.slice(5)
      if (toMeal !== fromMeal) handlers.onPlace(activeId, toMeal)
      return
    }
    const over = items.find((i) => i.id === overId)
    if (!over || over.id === moving.id) return
    const toMeal = mealIdOf(over, layout)
    const target = byMeal(toMeal)
    if (toMeal === fromMeal) {
      const from = target.findIndex((i) => i.id === activeId)
      const to = target.findIndex((i) => i.id === overId)
      handlers.onPlace(activeId, toMeal, arrayMove(target, from, to).findIndex((i) => i.id === activeId))
    } else {
      handlers.onPlace(activeId, toMeal, target.findIndex((i) => i.id === overId))
    }
  }

  const half = Math.ceil(layout.meals.length / 2)
  const section = (meal: MealDef) => <MealSection key={meal.id} meal={meal} index={layout.meals.indexOf(meal)} count={layout.meals.length} entries={byMeal(meal.id)} allItems={items} foods={foods} layout={layout} open={open.isOpen(meal.id)} onToggle={() => open.toggle(meal.id)} handlers={handlers} actions={actions} />
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => navigator.vibrate?.(8)} onDragEnd={onDragEnd} accessibility={{ announcements: ANNOUNCEMENTS, screenReaderInstructions: { draggable: "Para mover o alimento, aperte espaço, use as setas e aperte espaço de novo para soltar." } }}>
      <div data-testid="diet-meals" className="flex min-w-0 flex-col gap-1">
        <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 @min-[880px]:grid-cols-2 @min-[880px]:items-start">
          <div className="flex min-w-0 flex-col gap-1">{layout.meals.slice(0, half).map(section)}</div>
          <div className="flex min-w-0 flex-col gap-1">{layout.meals.slice(half).map(section)}</div>
        </div>
        {layout.meals.length < MAX_MEALS ? <AddPill label="Nova refeição" onClick={actions.onNewMeal} data-testid="new-meal" className="mt-1 h-11 md:h-11" /> : null}
      </div>
    </DndContext>
  )
}

// ------------------------------------------------------------------ the dialogs

/** "Nova refeição" / "Editar refeição": name (required, 40 characters, no repeats), optional time and icon. */
export function MealDialog({ state, meals, onClose, onSave }: { state: { meal: MealDef | null } | null; meals: MealDef[]; onClose: () => void; onSave: (input: MealInput, id: string | null) => void }) {
  return (
    <ResponsiveSheet open={state !== null} onOpenChange={(open) => !open && onClose()} title={state?.meal ? "Editar refeição" : "Nova refeição"} description="Dê um nome, e se quiser um horário e um ícone.">
      {state ? <MealForm key={state.meal?.id ?? "new"} meal={state.meal} meals={meals} onClose={onClose} onSave={onSave} /> : null}
    </ResponsiveSheet>
  )
}

function MealForm({ meal, meals, onClose, onSave }: { meal: MealDef | null; meals: MealDef[]; onClose: () => void; onSave: (input: MealInput, id: string | null) => void }) {
  const [name, setName] = useState(meal?.name ?? "")
  const [time, setTime] = useState(meal?.time ?? "")
  const [icon, setIcon] = useState<MealIconKey | null>(meal?.icon ?? null)
  const [touched, setTouched] = useState(false)
  const check = validateMealName(name, meals, meal?.id)
  const error = touched && !check.ok ? check.error : null
  return (
    <form
      noValidate
      data-testid="meal-form"
      className="flex flex-col gap-4 pb-1"
      onSubmit={(event) => {
        event.preventDefault()
        setTouched(true)
        if (!check.ok) return
        onSave({ name: check.name, time: time || null, icon }, meal?.id ?? null)
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="meal-name">Nome</Label>
        <Input id="meal-name" autoFocus value={name} maxLength={MEAL_NAME_MAX} placeholder="Ex.: Ceia" aria-invalid={error ? true : undefined} onChange={(e) => (setName(e.target.value), setTouched(true))} className="h-11 rounded-[12px]" />
        {error ? (
          <p role="alert" className="text-[13px] leading-5">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="meal-time">Horário (opcional)</Label>
        <Input id="meal-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-[12px]" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Ícone (opcional)</Label>
        <div role="radiogroup" aria-label="Ícone da refeição" className="flex flex-wrap gap-2">
          {MEAL_ICON_KEYS.map((key) => {
            const { icon: Icon, label } = MEAL_ICONS[key]
            const on = icon === key
            return (
              <button key={key} type="button" role="radio" aria-checked={on} aria-label={label} title={label} onClick={() => setIcon(on ? null : key)} className={cn("flex size-11 items-center justify-center rounded-full border outline-none focus-visible:ring-3 focus-visible:ring-ring/50", on ? "border-transparent bg-highlight text-highlight-foreground" : "border-border")}>
                <Icon aria-hidden strokeWidth={1.75} className="size-5" />
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!check.ok} className="h-11 rounded-full bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90 disabled:bg-muted disabled:text-muted-foreground">
          {meal ? "Salvar" : "Criar refeição"}
        </Button>
      </div>
    </form>
  )
}

/** Deleting a meal that has foods asks what to do with them: move them to another meal, or delete them with it. */
export function DeleteMealDialog({ state, meals, onClose, onConfirm }: { state: { meal: MealDef; count: number } | null; meals: MealDef[]; onClose: () => void; onConfirm: (moveTo: string | null) => void }) {
  const [choice, setChoice] = useState<string>("")
  const others = meals.filter((m) => m.id !== state?.meal.id)
  const target = choice || others[0]?.id || ""
  return (
    <ResponsiveSheet open={state !== null} onOpenChange={(open) => !open && onClose()} title="Excluir refeição" description={state ? `“${state.meal.name}” sai da sua lista de refeições.` : undefined}>
      {state ? (
        <div className="flex flex-col gap-4 pb-1" data-testid="delete-meal">
          {state.count > 0 ? (
            <div role="radiogroup" aria-label="O que fazer com os alimentos" className="flex flex-col gap-1">
              <p className="text-[14px] leading-5 text-muted-foreground">
                Há {state.count} {state.count === 1 ? "alimento" : "alimentos"} nessa refeição hoje. O que fazer?
              </p>
              {others.map((m) => (
                <label key={m.id} className="flex min-h-11 items-center gap-3 text-[15px]">
                  <input type="radio" name="move" checked={choice === m.id || (choice === "" && target === m.id)} onChange={() => setChoice(m.id)} className="size-4 accent-[var(--primary)]" /> Mover para {m.name}
                </label>
              ))}
              <label className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="radio" name="move" checked={choice === "delete"} onChange={() => setChoice("delete")} className="size-4 accent-[var(--primary)]" /> Excluir os alimentos junto
              </label>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-full px-5"
              onClick={() => {
                onConfirm(state.count > 0 && choice !== "delete" ? target : null)
                onClose()
              }}
            >
              <Trash2Icon strokeWidth={1.75} /> Excluir refeição
            </Button>
          </div>
        </div>
      ) : null}
    </ResponsiveSheet>
  )
}
