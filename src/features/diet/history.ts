// Pure helpers of the "Histórico" tab of Dieta. Everything is derived at read time from the meals and water already saved.
import { shiftDay } from "@/features/habits/stats"

import { EMPTY_MACROS, itemMacros, sumMacros, type Macros } from "./stats"
import { MEAL_LABELS, type FoodRow, type MealItemRow, type MealKind } from "./types"

export const HISTORY_PERIODS = [15, 30, 90] as const
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number]

/** A day counts as "on the goal" when its calories are within ±10% of the daily goal. */
export const GOAL_TOLERANCE = 0.1

/** A meal that holds more than this share of the day's calories gets a suggestion. */
export const DOMINANT_SHARE = 35

export const MEALS: MealKind[] = ["breakfast", "lunch", "snack", "dinner"]

/** The days of the window, oldest first, ending on `today` (so `n` days including today). */
export function periodDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(today, -(n - 1 - i)))
}

export type DayEntry = Macros & { day: string; /** True when at least one food was logged that day. */ logged: boolean }

/** One entry per day of the window (oldest first). Rows without a date belong to today; days outside the window are ignored. */
export function dailyEntries(items: MealItemRow[], foods: FoodRow[], today: string, n: number): DayEntry[] {
  const foodById = new Map(foods.map((f) => [f.id, f]))
  const byDay = new Map<string, Macros[]>()
  for (const item of items) {
    const food = foodById.get(item.food_id)
    const day = item.log_date ?? today
    byDay.set(day, [...(byDay.get(day) ?? []), food ? itemMacros(item, food) : EMPTY_MACROS])
  }
  return periodDays(today, n).map((day) => {
    const list = byDay.get(day)
    return { day, logged: Boolean(list?.length), ...sumMacros(list ?? []) }
  })
}

/** The daily average: total kcal divided by the days that have entries. A day with nothing logged is not a zero, it is unknown. */
export function averageKcal(entries: DayEntry[]) {
  const logged = entries.filter((e) => e.logged)
  if (logged.length === 0) return 0
  return Math.round(logged.reduce((sum, e) => sum + e.kcal, 0) / logged.length)
}

/** The average as a percentage of the goal (not capped: 110% reads as past the goal). */
export function goalPercent(average: number, goal: number) {
  return goal > 0 ? Math.round((average / goal) * 100) : 0
}

export type DayStatus = "on" | "under" | "over"

/** "on" inside ±10% of the goal (both ends included), otherwise below or above it. */
export function dayStatus(kcal: number, goal: number): DayStatus {
  const eps = 1e-9
  if (kcal < goal * (1 - GOAL_TOLERANCE) - eps) return "under"
  if (kcal > goal * (1 + GOAL_TOLERANCE) + eps) return "over"
  return "on"
}

/** Days within the goal out of the days that have entries. */
export function daysOnGoal(entries: DayEntry[], goal: number) {
  const logged = entries.filter((e) => e.logged)
  return { hit: logged.filter((e) => dayStatus(e.kcal, goal) === "on").length, logged: logged.length }
}

export type MealShare = { meal: MealKind; /** Average kcal per day with entries. */ kcal: number; /** 0–100, unrounded. */ share: number }

/** Average kcal per meal (over the days with entries) and the share of each in the day. All zero when nothing was logged. */
export function mealShares(items: MealItemRow[], foods: FoodRow[], today: string, n: number): MealShare[] {
  const days = new Set(periodDays(today, n))
  const inWindow = items.filter((i) => days.has(i.log_date ?? today))
  const loggedDays = new Set(inWindow.map((i) => i.log_date ?? today)).size
  const totals = MEALS.map((meal) => inWindow.filter((i) => i.meal === meal)).map((list) =>
    list.reduce((sum, item) => {
      const food = foods.find((f) => f.id === item.food_id)
      return sum + (food ? itemMacros(item, food).kcal : 0)
    }, 0)
  )
  const all = totals.reduce((a, b) => a + b, 0)
  return MEALS.map((meal, i) => ({ meal, kcal: loggedDays ? Math.round(totals[i] / loggedDays) : 0, share: all ? (totals[i] / all) * 100 : 0 }))
}

const WITH_ARTICLE: Record<MealKind, string> = { breakfast: "o café da manhã", lunch: "o almoço", snack: "o lanche", dinner: "o jantar" }

/** One sentence, only when a meal holds more than 35% of the calories; it suggests moving some to the lightest other meal. */
export function mealInsight(shares: MealShare[]): string | null {
  const top = [...shares].sort((a, b) => b.share - a.share)[0]
  if (!top || Math.round(top.share) <= DOMINANT_SHARE) return null
  const lightest = shares.filter((s) => s.meal !== top.meal).sort((a, b) => a.share - b.share)[0]
  return `${MEAL_LABELS[top.meal]} concentra ${Math.round(top.share)}% das calorias. Que tal levar parte para ${WITH_ARTICLE[lightest.meal]}?`
}

/** Average water per day that has a water entry, in millilitres. */
export function averageWaterMl(rows: { log_date?: string; ml: number }[], today: string, n: number) {
  const days = new Set(periodDays(today, n))
  const byDay = new Map<string, number>()
  for (const row of rows) {
    const day = row.log_date ?? today
    if (days.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + row.ml)
  }
  if (byDay.size === 0) return 0
  return Math.round([...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size)
}

/** A round axis for the calories chart: a step of 250, 500, 1000… so there are at most 5 lines, and the top always holds the data and the goal. */
export function niceAxis(maxValue: number) {
  const top = Math.max(maxValue, 1)
  const step = [250, 500, 1000, 2000, 5000].find((s) => Math.ceil(top / s) <= 5) ?? 5000
  const max = Math.ceil(top / step) * step
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) }
}

/** Show a label on every `step`-th day, counted back from today so today is always labelled. */
export function labelStep(n: number, mobile: boolean) {
  if (n <= 15) return mobile ? 3 : 2
  if (n <= 30) return mobile ? 6 : 3
  return mobile ? 15 : 10
}
