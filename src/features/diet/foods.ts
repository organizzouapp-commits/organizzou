// Pure helpers of the add-food sheet: recent foods and the search.
import type { FoodRow, MealItemRow } from "./types"

/** The foods logged most recently (newest day first, then the latest added), each once. */
export function recentFoods(items: MealItemRow[], foods: FoodRow[], limit = 8): FoodRow[] {
  const byId = new Map(foods.map((f) => [f.id, f]))
  const newestFirst = items.map((item, index) => ({ item, index })).sort((a, b) => (b.item.log_date ?? "").localeCompare(a.item.log_date ?? "") || b.index - a.index)
  const seen = new Set<string>()
  const out: FoodRow[] = []
  for (const { item } of newestFirst) {
    const food = byId.get(item.food_id)
    if (!food || seen.has(food.id)) continue
    seen.add(food.id)
    out.push(food)
    if (out.length === limit) break
  }
  return out
}

const plain = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

/** Foods whose name contains every typed word, ignoring case and accents; an empty query keeps them all. */
export function searchFoods(foods: FoodRow[], query: string): FoodRow[] {
  const words = plain(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return foods
  return foods.filter((f) => {
    const name = plain(f.name)
    return words.every((w) => name.includes(w))
  })
}
