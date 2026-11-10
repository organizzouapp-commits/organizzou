// What the Plano e cobrança tab shows about use against the plan's limits. Pure: the numbers come from src/lib/plans.ts and from counters read on the server.
import { PLANS, type LimitKey, type PlanId } from "./plans"

export type PlanUsage = {
  /** Task lists the person has, or null when it could not be read. */
  taskBoards: number | null
  /** Assistant messages sent today, or null when there is no counter to read. */
  assistantToday: number | null
}

export type UsageView = { value: string; percent: number | null; limit: number | null }

/**
 * "2 / 3" and a percentage for a limited plan; "Ilimitadas" for an unlimited one. With no counter (used = null) only the limit is shown and there is no bar.
 * `unlimitedText` is what the unlimited case says ("Ilimitadas", "Ilimitado").
 */
export function usageView(plan: PlanId, key: LimitKey, used: number | null, unlimitedText = "Ilimitadas"): UsageView {
  const limit = PLANS[plan].limits[key]
  if (limit === null) return { value: unlimitedText, percent: null, limit: null }
  if (used === null) return { value: String(limit), percent: null, limit }
  return { value: `${used} / ${limit}`, percent: limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100)), limit }
}

/** The saving of paying yearly instead of 12 months, in cents; 0 when there is no yearly price or it saves nothing. */
export function yearlySavingCents(plan: PlanId): number {
  const { monthlyCents, yearlyCents } = PLANS[plan].price
  return yearlyCents > 0 ? Math.max(0, monthlyCents * 12 - yearlyCents) : 0
}

/** True when the plan has a yearly price at all (otherwise the Mensal/Anual control is hidden). */
export const hasYearlyPrice = (plan: PlanId): boolean => PLANS[plan].price.yearlyCents > 0
