// The fields of the "Nova meta" sheet, step 2, turned into a link. Pure, so every kind of goal is checked without the screen.
import { parseDecimal } from "@/features/habits/steps"

import type { LinkSpec, Period } from "./linked"

export type Group = "finance" | "habit" | "study" | "workout" | "diet" | "tasks" | "free"

export type Fields = {
  /** The variant inside a group (see `SUBS`). */
  sub: string
  /** What it points at: a Finanças goal, a category, a habit, a subject, an exercise, a board / list / tag. */
  refId: string
  /** The name of a Finanças goal created from here. */
  name: string
  /** Cents: the target of a new Finanças goal, or the monthly limit of a category. */
  cents: number | null
  /** A number typed with a comma: days, hours, times, cards, workouts or kg. */
  amount: string
  mode: "streak" | "month_pct" | "week_times"
  period: Period
  /** The weight the person starts from (kg, typed). */
  startKg: string
}

export const SUBS: Record<Exclude<Group, "free">, { id: string; label: string }[]> = {
  finance: [
    { id: "existing", label: "Meta de economia que já tenho" },
    { id: "new", label: "Nova meta de economia" },
    { id: "limit", label: "Limite de gasto por categoria" },
  ],
  habit: [{ id: "habit", label: "Um hábito" }],
  study: [
    { id: "hours", label: "Horas de estudo" },
    { id: "cards", label: "Flashcards revisados" },
  ],
  workout: [
    { id: "count", label: "Treinos por semana ou mês" },
    { id: "pr", label: "Recorde de um exercício" },
  ],
  diet: [
    { id: "weight", label: "Peso alvo" },
    { id: "calories", label: "Dias na meta de calorias" },
  ],
  tasks: [
    { id: "board", label: "Um quadro" },
    { id: "list", label: "Uma lista" },
    { id: "tag", label: "Uma etiqueta" },
  ],
}

export const blankFields = (group: Group): Fields => ({ sub: group === "free" ? "" : SUBS[group][0].id, refId: "", name: "", cents: null, amount: "", mode: "streak", period: "week", startKg: "" })

export type Built = { spec: LinkSpec; /** A Finanças goal to create together with this goal (one record: the link points at it). */ newFinance?: { name: string; targetCents: number } }

const positive = (text: string) => parseDecimal(text)

/** The link the fields describe, or null while something is missing. */
export function buildLink(group: Group, f: Fields, titleFallback: string, newFinanceId: string): Built | null {
  const amount = positive(f.amount)
  switch (group) {
    case "free":
      return null
    case "finance":
      if (f.sub === "existing") return f.refId ? { spec: { kind: "finance_saving", goalId: f.refId } } : null
      if (f.sub === "new") return f.cents && f.cents > 0 ? { spec: { kind: "finance_saving", goalId: newFinanceId }, newFinance: { name: (f.name.trim() || titleFallback).slice(0, 80), targetCents: f.cents } } : null
      return f.refId && f.cents && f.cents > 0 ? { spec: { kind: "finance_limit", categoryId: f.refId, limitCents: f.cents } } : null
    case "habit":
      return f.refId && amount ? { spec: { kind: "habit", habitId: f.refId, mode: f.mode, target: f.mode === "month_pct" ? Math.min(100, amount) : f.mode === "week_times" ? Math.min(7, Math.round(amount)) : Math.round(amount) } } : null
    case "study":
      if (!amount) return null
      return f.sub === "hours" ? { spec: { kind: "study_hours", subjectId: f.refId || null, period: f.period, hours: amount } } : { spec: { kind: "study_cards", period: f.period, count: Math.round(amount) } }
    case "workout":
      if (!amount) return null
      return f.sub === "count" ? { spec: { kind: "workout_count", period: f.period, count: Math.round(amount) } } : f.refId ? { spec: { kind: "workout_pr", exerciseId: f.refId, targetKg: amount } } : null
    case "diet": {
      if (f.sub === "calories") return amount && amount <= 7 ? { spec: { kind: "calories_days", daysPerWeek: Math.round(amount) } } : null
      const start = positive(f.startKg)
      return amount && start && amount !== start ? { spec: { kind: "weight", targetKg: amount, startKg: start } } : null
    }
    case "tasks":
      return f.refId ? { spec: { kind: "tasks", scope: f.sub as "board" | "list" | "tag", scopeId: f.refId } } : null
  }
}

/** The fields that describe an existing link, so the edit sheet opens filled in. */
export function fieldsOf(spec: LinkSpec): { group: Group; fields: Fields } {
  const base = (group: Exclude<Group, "free">) => blankFields(group)
  const num = (n: number) => String(n).replace(".", ",")
  switch (spec.kind) {
    case "finance_saving":
      return { group: "finance", fields: { ...base("finance"), sub: "existing", refId: spec.goalId } }
    case "finance_limit":
      return { group: "finance", fields: { ...base("finance"), sub: "limit", refId: spec.categoryId, cents: spec.limitCents } }
    case "habit":
      return { group: "habit", fields: { ...base("habit"), refId: spec.habitId, mode: spec.mode, amount: num(spec.target) } }
    case "study_hours":
      return { group: "study", fields: { ...base("study"), sub: "hours", refId: spec.subjectId ?? "", period: spec.period, amount: num(spec.hours) } }
    case "study_cards":
      return { group: "study", fields: { ...base("study"), sub: "cards", period: spec.period, amount: num(spec.count) } }
    case "workout_count":
      return { group: "workout", fields: { ...base("workout"), sub: "count", period: spec.period, amount: num(spec.count) } }
    case "workout_pr":
      return { group: "workout", fields: { ...base("workout"), sub: "pr", refId: spec.exerciseId, amount: num(spec.targetKg) } }
    case "weight":
      return { group: "diet", fields: { ...base("diet"), sub: "weight", amount: num(spec.targetKg), startKg: num(spec.startKg) } }
    case "calories_days":
      return { group: "diet", fields: { ...base("diet"), sub: "calories", amount: num(spec.daysPerWeek) } }
    case "tasks":
      return { group: "tasks", fields: { ...base("tasks"), sub: spec.scope, refId: spec.scopeId } }
  }
}

/** The dates of the goal: the end must come after the start (an empty end is fine: no deadline). */
export function validateDates(start: string, end: string): { start: string | null; end: string | null } {
  const ISO = /^\d{4}-\d{2}-\d{2}$/
  if (!ISO.test(start)) return { start: "Escolha a data de início.", end: null }
  if (end && !ISO.test(end)) return { start: null, end: "Escolha o prazo final." }
  if (end && end <= start) return { start: null, end: "O prazo final precisa ser depois da data de início." }
  return { start: null, end: null }
}
