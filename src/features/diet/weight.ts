// Pure helpers of the "Peso" tab of Dieta. Everything is derived from the weigh-ins already saved; the goal is `diet_goals.target_weight_kg`.
import { shiftDay } from "@/features/habits/stats"

export type WeightPoint = { id?: string; log_date: string; weight_kg: number }

export const WEIGHT_PERIODS = [30, 90, 365] as const
export type WeightPeriod = (typeof WEIGHT_PERIODS)[number]

/** Realistic bounds of a weigh-in (kg), the same ones the form validates. */
export const MIN_KG = 20
export const MAX_KG = 400

const round1 = (n: number) => Math.round(n * 10) / 10

export const sortWeights = <T extends WeightPoint>(rows: T[]): T[] => [...rows].sort((a, b) => a.log_date.localeCompare(b.log_date))

/** The weigh-ins of the last `days` days (today included), oldest first. */
export function weightsInPeriod<T extends WeightPoint>(sorted: T[], today: string, days: number): T[] {
  const since = shiftDay(today, -days)
  return sorted.filter((w) => w.log_date >= since && w.log_date <= today)
}

/** Last minus first weigh-in of a period (one decimal); null with fewer than two entries. */
export function variation(points: WeightPoint[]): number | null {
  if (points.length < 2) return null
  return round1(points[points.length - 1].weight_kg - points[0].weight_kg)
}

/** Each entry's change against the previous one (sorted oldest first); null for the very first entry. */
export function deltasVsPrevious<T extends WeightPoint & { id: string }>(sorted: T[]): Map<string, number | null> {
  return new Map(sorted.map((w, i) => [w.id, i === 0 ? null : round1(w.weight_kg - sorted[i - 1].weight_kg)]))
}

/** Uniform integer ticks for the weight axis: every 1 kg while the range is small (widening to 2, 5 or 10 kg for long ranges), with a little air around the data. */
export function yTicks(values: number[]) {
  if (values.length === 0) return { ticks: [0, 1], min: 0, max: 1 }
  let lo = Math.floor(Math.min(...values) - 0.2)
  let hi = Math.ceil(Math.max(...values) + 0.2)
  const span = hi - lo
  const step = span <= 8 ? 1 : span <= 16 ? 2 : span <= 40 ? 5 : 10
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  return { ticks: Array.from({ length: (hi - lo) / step + 1 }, (_, i) => lo + i * step), min: lo, max: hi }
}

export type GoalProgress = { /** 0–100. */ pct: number; /** kg still to go (0 once reached). */ remaining: number; reached: boolean }

/** Progress from the first weigh-in ever to the target, in either direction (losing or gaining). Null without a goal or without entries. */
export function goalProgress(sorted: WeightPoint[], target: number | null): GoalProgress | null {
  if (target === null || sorted.length === 0) return null
  const start = sorted[0].weight_kg
  const current = sorted[sorted.length - 1].weight_kg
  const sign = start >= target ? 1 : -1
  const total = Math.abs(start - target)
  const done = sign * (start - current)
  const reached = sign * (current - target) <= 0
  const pct = reached ? 100 : total === 0 ? 0 : Math.max(0, Math.min(100, Math.round((done / total) * 100)))
  return { pct, remaining: reached ? 0 : round1(Math.abs(current - target)), reached }
}

/** "80,0 kg" */
export const kgText = (kg: number) => `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
/** "80" or "80,5" */
export const kgPlain = (kg: number) => kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
/** "−2,4", "+1,2" or "0" (a real minus sign). */
export function signedKg(delta: number) {
  if (delta === 0) return "0"
  const abs = Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })
  return `${delta < 0 ? "−" : "+"}${abs}`
}

/** The − / + of the weight field: 0,1 kg, one decimal, inside the valid range. */
export const stepKg = (kg: number, direction: 1 | -1) => Math.min(MAX_KG, Math.max(MIN_KG, round1(kg + direction * 0.1)))

/** "80,5" or "80.5" → 80.5; null when it is not a number. */
export function parseKg(text: string): number | null {
  const n = Number(text.trim().replace(",", "."))
  return text.trim() !== "" && Number.isFinite(n) ? n : null
}

export const validKg = (kg: number | null): kg is number => kg !== null && kg > MIN_KG && kg < MAX_KG

/** The goal rows after saving a target weight (null removes it): the existing row keeps its other numbers, a first one starts from `defaults`. */
export function withTargetWeight<T extends { target_weight_kg: number | null }>(rows: T[], defaults: T, kg: number | null): T[] {
  return [{ ...(rows[0] ?? defaults), target_weight_kg: kg }]
}
