import "server-only"

import { parseBudget } from "./assistant-cost"
import { assistantBudgetSetting } from "./data"

export type BudgetInfo = {
  usd: number | null
  /** Where the number comes from: what the admin saved, the environment variable, or nothing. */
  source: "setting" | "env" | "none"
  /** The settings table exists, so the admin can save a budget from the screen. */
  canSave: boolean
}

/** The monthly budget in US$: what the admin saved wins, then ASSISTANT_MONTHLY_BUDGET_USD, then none. */
export async function loadBudget(): Promise<BudgetInfo> {
  const saved = await assistantBudgetSetting()
  const fromEnv = parseBudget(process.env.ASSISTANT_MONTHLY_BUDGET_USD)
  if (saved.ok && parseBudget(saved.data) != null) return { usd: parseBudget(saved.data), source: "setting", canSave: true }
  if (fromEnv != null) return { usd: fromEnv, source: "env", canSave: saved.ok }
  return { usd: null, source: "none", canSave: saved.ok }
}
