// Pure helpers of the "Hoje" tab of Dieta: what is left of the day, the macro bars and the water pips.

/** Calories left of the day: a positive number while under the goal, `over` once past it (then `value` is how far past). */
export function remainingKcal(consumed: number, goal: number) {
  const left = Math.round(goal - consumed)
  return { value: Math.abs(left), over: left < 0 }
}

/** 0–100 for a bar: consumed over goal, capped at 100, 0 without a goal. */
export function macroPercent(value: number, goal: number) {
  if (!(goal > 0) || !(value > 0)) return 0
  return Math.min(100, Math.round((value / goal) * 100))
}

/** How many little drops the water row has and how many millilitres each one is worth (always 10, each 10% of the goal). */
export const WATER_PIPS = 10
export function waterPips(goalMl: number) {
  return { count: WATER_PIPS, mlEach: goalMl > 0 ? goalMl / WATER_PIPS : 0 }
}

/** Filled pips for the water drunk so far (a pip fills when its whole share is reached). */
export function filledPips(ml: number, goalMl: number) {
  const { count, mlEach } = waterPips(goalMl)
  if (mlEach <= 0 || ml <= 0) return 0
  return Math.min(count, Math.floor((ml + 1e-6) / mlEach))
}

/** "0,25", "2,5": litres without the unit. */
export const litersText = (ml: number) => (ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })

/** "1.872" */
export const kcalText = (value: number) => Math.round(value).toLocaleString("pt-BR")
