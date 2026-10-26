import { shiftDay } from "@/features/habits/stats"
import type { DietGoalRow, FoodRow, MealItemRow, WeightLogRow } from "@/features/diet/types"

import { dayOf } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"

const food = (n: number, name: string, serving: string, kcal: number, p: number, c: number, f: number): FoodRow => ({
  id: `f0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  user_id: null,
  name,
  serving_label: serving,
  kcal,
  protein_g: p,
  carbs_g: c,
  fat_g: f,
})

/** Shared catalog (values close to the TACO table). */
export const mockFoods: FoodRow[] = [
  food(1, "Arroz branco cozido", "100 g", 128, 2.5, 28.1, 0.2),
  food(2, "Feijão carioca cozido", "100 g", 76, 4.8, 13.6, 0.5),
  food(3, "Peito de frango grelhado", "100 g", 159, 32, 0, 2.5),
  food(4, "Ovo cozido", "1 unidade (50 g)", 78, 6.3, 0.6, 5.3),
  food(5, "Pão francês", "1 unidade (50 g)", 150, 4.7, 29.4, 1.6),
  food(6, "Café com leite", "1 xícara (150 ml)", 55, 3, 5, 2.5),
  food(7, "Banana prata", "1 unidade (70 g)", 60, 0.8, 15.4, 0.1),
  food(8, "Maçã", "1 unidade (130 g)", 70, 0.4, 18.6, 0.2),
  food(9, "Iogurte natural", "1 pote (170 g)", 100, 6.5, 8, 4.5),
  food(10, "Aveia em flocos", "3 colheres (30 g)", 117, 4.2, 20, 2.4),
  food(11, "Whey protein", "1 dose (30 g)", 120, 24, 3, 1.5),
  food(12, "Azeite de oliva", "1 colher de sopa (13 g)", 117, 0, 0, 13),
  food(13, "Batata-doce cozida", "100 g", 77, 0.6, 18.4, 0.1),
  food(14, "Salada de alface e tomate", "1 prato (100 g)", 20, 1, 4, 0.2),
  food(15, "Tapioca com queijo", "1 unidade (80 g)", 190, 6, 30, 5),
  food(16, "Pizza de mussarela", "1 fatia (100 g)", 270, 11, 33, 10),
  food(17, "Carne moída refogada", "100 g", 212, 26, 0, 11),
  food(18, "Macarrão cozido", "100 g", 158, 5.8, 30.9, 0.9),
]

const F = (n: number) => mockFoods[n - 1].id

export const mockDietGoal: DietGoalRow = {
  user_id: USER,
  kcal: 2200,
  protein_g: 140,
  carbs_g: 250,
  fat_g: 70,
  water_ml: 2500,
  target_weight_kg: 78,
}

let itemCounter = 0
const item = (meal: MealItemRow["meal"], foodNumber: number, servings: number): MealItemRow => {
  itemCounter += 1
  return { id: `i0000000-0000-4000-8000-${String(itemCounter).padStart(12, "0")}`, meal, food_id: F(foodNumber), servings }
}

export function buildMockMealItems(): MealItemRow[] {
  itemCounter = 0
  return [
    item("breakfast", 5, 1),
    item("breakfast", 4, 2),
    item("breakfast", 6, 1),
    item("lunch", 1, 2),
    item("lunch", 2, 1.5),
    item("lunch", 3, 1.5),
    item("lunch", 14, 1),
    item("lunch", 12, 0.5),
    item("snack", 7, 1),
    item("snack", 9, 1),
  ]
}

/** Daily calorie totals for the previous days (today comes from the live meals). */
export function buildMockDailyKcal(now: string, days = 14) {
  const today = dayOf(now)
  return Array.from({ length: days }, (_, index) => {
    const offset = days - index
    const day = shiftDay(today, -offset)
    const wobble = ((offset * 37) % 11) - 5
    return { day, kcal: 2050 + wobble * 55, protein: 118 + (wobble + 5) * 3 }
  })
}

export function buildMockWeight(now: string): WeightLogRow[] {
  const today = dayOf(now)
  return Array.from({ length: 12 }, (_, index) => {
    const weeksBack = 11 - index
    return {
      id: `w0000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      user_id: USER,
      log_date: shiftDay(today, -weeksBack * 7),
      weight_kg: Math.round((82.4 - index * 0.22 + (index % 3 === 1 ? 0.3 : 0)) * 10) / 10,
    }
  })
}
