// Goal habits ("Meta diária"): the unit decides the step of the "+" button, and a water unit ties the habit to the Dieta water. Pure.
import type { HabitRow } from "./types"

export type UnitKind = "liter" | "ml" | "cup" | "minute" | "other"

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

/** "L", "litros", "ml", "copos", "min", "minutos"... -> what kind of unit it is. */
export function unitKind(unit: string | null | undefined): UnitKind {
  const u = fold(unit ?? "").replace(/\.$/, "")
  if (u === "l" || /^litros?$/.test(u)) return "liter"
  if (u === "ml" || /^mililitros?$/.test(u)) return "ml"
  if (/^copos?$/.test(u)) return "cup"
  if (u === "min" || /^minutos?$/.test(u)) return "minute"
  return "other"
}

/** The sensible step of the "+" for a unit: L 0,25 · ml 250 · copos 1 · minutos 5 · anything else 1. */
export function defaultStep(unit: string | null | undefined): number {
  switch (unitKind(unit)) {
    case "liter":
      return 0.25
    case "ml":
      return 250
    case "cup":
      return 1
    case "minute":
      return 5
    default:
      return 1
  }
}

export const isWaterUnit = (unit: string | null | undefined) => ["liter", "ml", "cup"].includes(unitKind(unit))

/** A name or unit that looks like water: the form suggests tying the habit to the Dieta water. */
export const looksLikeWater = (name: string, unit: string | null | undefined) => isWaterUnit(unit) || /\b(agua|beber|hidrat)/.test(fold(name))

/** One cup ("copo") counts as 250 ml, the glass Dieta already uses. */
export const CUP_ML = 250

export function toMl(qty: number, unit: string | null | undefined): number {
  switch (unitKind(unit)) {
    case "liter":
      return Math.round(qty * 1000)
    case "cup":
      return Math.round(qty * CUP_ML)
    default:
      return Math.round(qty)
  }
}

export function fromMl(ml: number, unit: string | null | undefined): number {
  switch (unitKind(unit)) {
    case "liter":
      return Math.round(ml) / 1000
    case "cup":
      return Math.round((ml / CUP_ML) * 100) / 100
    default:
      return Math.round(ml)
  }
}

/** "3,5" or "3.5" -> 3.5; null when it is not a positive number. Keeps the decimals (a meta of 3,5 is never rounded to 3 or 4). */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** 3.5 -> "3,5"; 0.25 -> "0,25"; 1250 -> "1250". At most 2 decimals. */
export const formatDecimal = (value: number): string => String(Math.round(value * 100) / 100).replace(".", ",")

/** The step actually used: the one typed (when valid), else the default of the unit. */
export const stepOf = (habit: Pick<HabitRow, "unit">, custom?: number | null): number => (custom && custom > 0 ? custom : defaultStep(habit.unit))

/** A goal habit whose unit is water: its progress IS the day's water (Dieta), and its goal IS the water goal. */
export const isWaterHabit = (habit: Pick<HabitRow, "type" | "unit">): boolean => habit.type === "goal" && isWaterUnit(habit.unit)
