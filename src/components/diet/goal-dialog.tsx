"use client"

import { useState } from "react"

import { ResponsiveSheet } from "@/components/tasks/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fieldClass, StickyFooter } from "@/components/workouts/sheet-fields"
import type { DietGoalRow } from "@/features/diet/types"

type Values = Pick<DietGoalRow, "kcal" | "protein_g" | "carbs_g" | "fat_g" | "water_ml">

const FIELDS: { key: keyof Values; label: string; unit: string; min: number; max: number }[] = [
  { key: "kcal", label: "Calorias por dia", unit: "kcal", min: 1, max: 20000 },
  { key: "protein_g", label: "Proteína", unit: "g", min: 0, max: 2000 },
  { key: "carbs_g", label: "Carboidratos", unit: "g", min: 0, max: 2000 },
  { key: "fat_g", label: "Gorduras", unit: "g", min: 0, max: 2000 },
  { key: "water_ml", label: "Água por dia", unit: "ml", min: 1, max: 20000 },
]

/** Edits the daily goals (calories, macros, water). The numbers are saved in the same `diet_goals` row the Hoje tab reads. */
export function GoalDialog({ open, goal, onOpenChange, onSave }: { open: boolean; goal: DietGoalRow; onOpenChange: (open: boolean) => void; onSave: (values: Values) => void }) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Editar meta" description="Metas diárias de calorias, macros e água.">
      {open ? <GoalForm goal={goal} onSave={onSave} onClose={() => onOpenChange(false)} /> : null}
    </ResponsiveSheet>
  )
}

function GoalForm({ goal, onSave, onClose }: { goal: DietGoalRow; onSave: (values: Values) => void; onClose: () => void }) {
  const [text, setText] = useState<Record<keyof Values, string>>({ kcal: String(goal.kcal), protein_g: String(goal.protein_g), carbs_g: String(goal.carbs_g), fat_g: String(goal.fat_g), water_ml: String(goal.water_ml) })
  const valid = FIELDS.every((f) => text[f.key] !== "" && Number(text[f.key]) >= f.min && Number(text[f.key]) <= f.max)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave({ kcal: Number(text.kcal), protein_g: Number(text.protein_g), carbs_g: Number(text.carbs_g), fat_g: Number(text.fat_g), water_ml: Number(text.water_ml) })
        onClose()
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map((f, i) => (
          <div key={f.key} className={i === 0 ? "col-span-2 flex flex-col gap-2" : "flex flex-col gap-2"}>
            <Label htmlFor={`goal-${f.key}`}>
              {f.label} <span className="text-muted-foreground">({f.unit})</span>
            </Label>
            <Input id={`goal-${f.key}`} autoFocus={i === 0} inputMode="numeric" value={text[f.key]} aria-invalid={text[f.key] === "" || Number(text[f.key]) < f.min || Number(text[f.key]) > f.max} onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value.replace(/[^\d]/g, "") }))} className={`${fieldClass} tabular`} />
          </div>
        ))}
      </div>
      <StickyFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valid} className="bg-highlight text-highlight-foreground hover:bg-highlight/90">
          Salvar
        </Button>
      </StickyFooter>
    </form>
  )
}
