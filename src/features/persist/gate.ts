import { type Feature, MODULE_LABELS } from "@/lib/plans"

import type { TableName } from "./registry"

/**
 * Which Pro feature a table belongs to. The server checks this before it writes (persistRows), so a Free account cannot create or change
 * data in a locked module by calling the action directly. Deleting is never blocked, and nothing here removes data: a locked module only
 * stops accepting new writes, what is stored stays and comes back when Pro returns.
 */
const MODULE_OF: Partial<Record<TableName, Feature>> = {
  habits: "moduleRotina",
  habit_logs: "moduleRotina",
  events: "moduleAgenda",
  exercises: "moduleTreinos",
  workout_plans: "moduleTreinos",
  plan_exercises: "moduleTreinos",
  workout_sessions: "moduleTreinos",
  set_logs: "moduleTreinos",
  foods: "moduleDieta",
  meal_items: "moduleDieta",
  user_meals: "moduleDieta",
  diet_goals: "moduleDieta",
  weight_logs: "moduleDieta",
  water_logs: "moduleDieta",
  subjects: "moduleEstudos",
  study_sessions: "moduleEstudos",
  study_deadlines: "moduleEstudos",
  flashcard_decks: "moduleEstudos",
  flashcards: "moduleEstudos",
  note_folders: "moduleNotas",
  notes: "moduleNotas",
  life_goals: "moduleMetas",
  life_goal_links: "moduleMetas",
  life_goal_milestones: "moduleMetas",
  journal_entries: "moduleDiario",
  finance_bills: "financeRecurring",
  finance_goals: "financeGoals",
}

/** The feature a write needs, or null when Free may do it. A category with a monthly limit is a budget (Pro); a plain category is not. */
export function featureForWrite(table: TableName, rows: unknown[]): Feature | null {
  if (table === "finance_categories") return rows.some((r) => typeof (r as { monthly_limit_cents?: unknown }).monthly_limit_cents === "number") ? "financeBudget" : null
  return MODULE_OF[table] ?? null
}

const FEATURE_TEXT: Partial<Record<Feature, string>> = {
  financeRecurring: "Contas fixas e parceladas",
  financeGoals: "Metas financeiras",
  financeBudget: "O orçamento por categoria",
}

/** The message shown when the plan does not include what was saved. */
export function planBlockMessage(feature: Feature): string {
  const name = MODULE_LABELS[feature] ?? FEATURE_TEXT[feature] ?? "Este recurso"
  return `${name} faz parte do Pro. O que você já salvou continua guardado e volta quando o Pro voltar.`
}
