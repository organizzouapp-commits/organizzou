"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PlusIcon, SearchIcon } from "lucide-react"

import { SegmentedPills } from "@/components/finance/bento"
import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DecimalStepper, fieldClass, pillBase, pillOff, pillOn, StickyFooter } from "@/components/workouts/sheet-fields"
import { searchFoods } from "@/features/diet/foods"
import { MEALS } from "@/features/diet/history"
import { itemMacros } from "@/features/diet/stats"
import { MEAL_LABELS, type FoodRow, type MealKind } from "@/features/diet/types"
import { MAX_KG, MIN_KG, parseKg, validKg } from "@/features/diet/weight"
import { shiftDay } from "@/features/habits/stats"
import { cn } from "@/lib/utils"

const LIMA_BUTTON = "bg-highlight text-highlight-foreground hover:bg-highlight/90"
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

// ------------------------------------------------------------------ add food (2 steps)

/** "Adicionar alimento": step 1 searches the catalog (recent foods first), step 2 picks the meal and the quantity. */
export function FoodSheet({ meal, foods, recents, onClose, onAdd }: { meal: MealKind | null; foods: FoodRow[]; recents: FoodRow[]; onClose: () => void; onAdd: (meal: MealKind, foodId: string, servings: number) => void }) {
  const [chosen, setChosen] = useState<FoodRow | null>(null)
  const close = () => {
    setChosen(null)
    onClose()
  }
  return (
    <ResponsiveSheet
      open={Boolean(meal)}
      onOpenChange={(open) => !open && close()}
      title={chosen ? chosen.name : "Adicionar alimento"}
      description={chosen ? `Porção: ${chosen.serving_label} · passo 2 de 2` : meal ? `${MEAL_LABELS[meal]} · passo 1 de 2` : undefined}
    >
      {meal ? (
        chosen ? (
          <QuantityStep
            key={chosen.id}
            food={chosen}
            initialMeal={meal}
            onBack={() => setChosen(null)}
            onAdd={(m, servings) => {
              onAdd(m, chosen.id, servings)
              close()
            }}
          />
        ) : (
          <SearchStep foods={foods} recents={recents} onPick={setChosen} onCancel={close} />
        )
      ) : null}
    </ResponsiveSheet>
  )
}

type Source = "recentes" | "todos"

function SearchStep({ foods, recents, onPick, onCancel }: { foods: FoodRow[]; recents: FoodRow[]; onPick: (food: FoodRow) => void; onCancel: () => void }) {
  const [query, setQuery] = useState("")
  // Favorites do not exist yet (no flag on foods), so only Recentes and Todos are offered.
  const [source, setSource] = useState<Source>(recents.length > 0 ? "recentes" : "todos")
  const searching = query.trim() !== ""
  const list = searching ? searchFoods(foods, query) : source === "recentes" ? recents : foods
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <SearchIcon aria-hidden strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus aria-label="Buscar alimento" placeholder="Buscar alimento" value={query} onChange={(e) => setQuery(e.target.value)} className={cn(fieldClass, "pl-9")} />
      </div>
      <SegmentedPills<Source>
        ariaLabel="Lista de alimentos"
        items={[
          { id: "recentes", label: "Recentes" },
          { id: "todos", label: "Todos" },
        ]}
        value={searching ? "todos" : source}
        onChange={(id) => {
          setQuery("")
          setSource(id)
        }}
        className="w-full [&>button]:flex-1"
      />
      <ul data-testid="food-results" className="scroll-soft -mx-2 flex max-h-[min(46dvh,340px)] min-h-14 flex-col overflow-y-auto">
        {list.length === 0 ? <li className="px-2 py-4 text-[13px] leading-5 text-muted-foreground">{searching ? "Nenhum alimento encontrado." : "Nada por aqui ainda. Veja a lista completa em Todos."}</li> : null}
        {list.map((f) => (
          <li key={f.id}>
            <button type="button" data-food={f.id} onClick={() => onPick(f)} className="flex min-h-14 w-full items-center gap-3 rounded-[14px] px-2 py-1.5 text-left outline-none transition-colors duration-[400ms] hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-6 font-medium">{f.name}</span>
                <span className="truncate text-[13px] leading-5 text-muted-foreground">{f.serving_label}</span>
              </span>
              <span className="tabular shrink-0 text-[13px] leading-5 text-muted-foreground">{f.kcal} kcal</span>
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
                <PlusIcon strokeWidth={1.75} className="size-4" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </StickyFooter>
    </div>
  )
}

function QuantityStep({ food, initialMeal, onBack, onAdd }: { food: FoodRow; initialMeal: MealKind; onBack: () => void; onAdd: (meal: MealKind, servings: number) => void }) {
  const [meal, setMeal] = useState<MealKind>(initialMeal)
  const [servings, setServings] = useState("1")
  const amount = Number(servings.replace(",", ".")) || 0
  const macros = itemMacros({ servings: amount }, food)
  const tiles = [
    { label: "kcal", value: String(macros.kcal) },
    { label: "Prot.", value: `${num(macros.protein)} g` },
    { label: "Carb.", value: `${num(macros.carbs)} g` },
    { label: "Gord.", value: `${num(macros.fat)} g` },
  ]
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (amount <= 0) return
        onAdd(meal, amount)
      }}
    >
      <div className="flex flex-col gap-2">
        <Label>Refeição</Label>
        <div role="group" aria-label="Refeição" className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <button key={m} type="button" aria-pressed={meal === m} data-meal={m} onClick={() => setMeal(m)} className={cn(pillBase, meal === m ? pillOn : pillOff)}>
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="servings">Quantidade de porções</Label>
        <DecimalStepper id="servings" label="Quantidade de porções" value={servings} onChange={setServings} step={0.5} min={0.5} max={99} decimals={2} />
      </div>
      <dl data-testid="food-preview" className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="flex min-w-0 flex-col items-center gap-0.5 rounded-[14px] border border-border py-2">
            <dd className="tabular max-w-full truncate px-1 text-[15px] leading-6 font-semibold">{t.value}</dd>
            <dt className="text-[11px] leading-4 text-muted-foreground">{t.label}</dt>
          </div>
        ))}
      </dl>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" disabled={amount <= 0} className={LIMA_BUTTON}>
          Adicionar
        </Button>
      </StickyFooter>
    </form>
  )
}

// ------------------------------------------------------------------ weigh-in

export type WeightDraft = { id?: string; date: string; weight: number; note: string }
export type WeightValues = { id?: string; date: string; weight: number; note: string }

/** "Registrar peso" (or "Editar peso" when `draft.id` is set): date, a large stepper in 0,1 kg and an optional note. */
export function WeightSheet({ draft, today, onClose, onSave }: { draft: WeightDraft | null; today: string; onClose: () => void; onSave: (values: WeightValues) => void }) {
  return (
    <ResponsiveSheet open={Boolean(draft)} onOpenChange={(open) => !open && onClose()} title={draft?.id ? "Editar peso" : "Registrar peso"} description="Informe o peso e o dia da pesagem.">
      {draft ? <WeightForm draft={draft} today={today} onClose={onClose} onSave={onSave} /> : null}
    </ResponsiveSheet>
  )
}

function WeightForm({ draft, today, onClose, onSave }: { draft: WeightDraft; today: string; onClose: () => void; onSave: (values: WeightValues) => void }) {
  const [date, setDate] = useState(draft.date)
  const [value, setValue] = useState(draft.weight.toFixed(1).replace(".", ","))
  const [note, setNote] = useState(draft.note)
  const kg = parseKg(value)
  const valid = validKg(kg)
  // The last 30 days, plus the day being edited when it is older.
  const days = Array.from({ length: 30 }, (_, i) => shiftDay(today, -i))
  if (!days.includes(draft.date)) days.push(draft.date)
  const label = (d: string) => `${d === today ? "Hoje, " : ""}${format(parseISO(d), "d 'de' MMM 'de' yyyy", { locale: ptBR }).replace(".", "")}`

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!validKg(kg)) return
        onSave({ id: draft.id, date, weight: Math.round(kg * 10) / 10, note: note.trim() })
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="weight-date">Data</Label>
        <Select value={date} onValueChange={setDate}>
          <SelectTrigger id="weight-date" className="h-11 w-full rounded-[12px] data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {label(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="weight">Peso</Label>
        <DecimalStepper id="weight" label="Peso" size="lg" unit="kg" fixed value={value} onChange={setValue} step={0.1} min={MIN_KG} max={MAX_KG} />
        {value !== "" && !valid ? (
          <p className="text-[13px] leading-5 text-muted-foreground">
            Informe um peso entre {MIN_KG} e {MAX_KG} kg.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="weight-note">Nota (opcional)</Label>
        <Input id="weight-note" value={note} maxLength={300} placeholder="Ex.: em jejum, depois do treino" onChange={(e) => setNote(e.target.value)} className={fieldClass} />
      </div>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} className={LIMA_BUTTON}>
          Salvar
        </Button>
      </StickyFooter>
    </form>
  )
}

// ------------------------------------------------------------------ weight goal

/** The small dialog of the weight goal: one kg field; with a goal already set, a button also clears it. */
export function WeightGoalSheet({ open, target, onClose, onSave }: { open: boolean; target: number | null; onClose: () => void; onSave: (kg: number | null) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={(o) => !o && onClose()} title={target === null ? "Definir meta" : "Editar meta"} description="O peso que você quer alcançar.">
      {open ? <GoalForm target={target} onClose={onClose} onSave={onSave} /> : null}
    </ResponsiveSheet>
  )
}

function GoalForm({ target, onClose, onSave }: { target: number | null; onClose: () => void; onSave: (kg: number | null) => void }) {
  const [value, setValue] = useState(target === null ? "" : String(target).replace(".", ","))
  const kg = parseKg(value)
  const valid = validKg(kg)
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!validKg(kg)) return
        onSave(Math.round(kg * 10) / 10)
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="goal-weight">Peso desejado (kg)</Label>
        <Input id="goal-weight" autoFocus inputMode="decimal" placeholder="Ex.: 75,0" value={value} aria-invalid={value !== "" && !valid} onChange={(e) => /^\d{0,3}[,.]?\d{0,1}$/.test(e.target.value) && setValue(e.target.value)} className={cn(fieldClass, "tabular")} />
      </div>
      <StickyFooter>
        {target !== null ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onSave(null)
              onClose()
            }}
          >
            Remover
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={!valid} className={LIMA_BUTTON}>
          Salvar
        </Button>
      </StickyFooter>
    </form>
  )
}
