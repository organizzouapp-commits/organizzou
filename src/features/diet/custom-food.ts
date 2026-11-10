// Pure helpers of "Novo alimento": the portion units and their label, the calories implied by the macros, and the validation of the form.

export const PORTION_UNITS = [
  { id: "g", one: "g", many: "g" },
  { id: "ml", one: "ml", many: "ml" },
  { id: "unidade", one: "unidade", many: "unidades" },
  { id: "colher-sopa", one: "colher de sopa", many: "colheres de sopa" },
  { id: "colher-cha", one: "colher de chá", many: "colheres de chá" },
  { id: "xicara", one: "xícara", many: "xícaras" },
  { id: "fatia", one: "fatia", many: "fatias" },
  { id: "pote", one: "pote", many: "potes" },
] as const
export type PortionUnitId = (typeof PORTION_UNITS)[number]["id"]

const NUMBER_PT = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })

/** "100 g", "1 colher de sopa", "2 xícaras": what one serving is. Weights and volumes never take a plural. */
export function servingLabel(qty: number, unit: PortionUnitId): string {
  const u = PORTION_UNITS.find((p) => p.id === unit) ?? PORTION_UNITS[0]
  return `${NUMBER_PT(qty)} ${qty === 1 ? u.one : u.many}`
}

/** Calories the macros add up to (4 per gram of protein and of carbohydrate, 9 per gram of fat), rounded. */
export const approxKcal = (protein: number, carbs: number, fat: number): number => Math.round(protein * 4 + carbs * 4 + fat * 9)

/** "12,5" or "12.5" → 12.5; blank → null; anything else (or negative) → NaN. */
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(",", ".")
  if (clean === "") return null
  return /^\d*\.?\d+$|^\d+\.$/.test(clean) ? Number(clean) : Number.NaN
}

export type FoodForm = { name: string; portionQty: string; unit: PortionUnitId; kcal: string; protein: string; carbs: string; fat: string; fiber: string }
export const EMPTY_FOOD_FORM: FoodForm = { name: "", portionQty: "1", unit: "unidade", kcal: "", protein: "", carbs: "", fat: "", fiber: "" }

export type FoodValues = { name: string; serving_label: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null }
export type FoodErrors = Partial<Record<"name" | "portionQty" | "kcal" | "protein" | "carbs" | "fat" | "fiber", string>>

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ")

/** The calories to suggest while typing: only when the kcal field is empty and at least one macro is filled. */
export function kcalHint(form: FoodForm): number | null {
  if (parseNumber(form.kcal) !== null) return null
  const [p, c, f] = [form.protein, form.carbs, form.fat].map((t) => parseNumber(t))
  if ([p, c, f].every((v) => v === null)) return null
  if ([p, c, f].some((v) => v !== null && Number.isNaN(v))) return null
  return approxKcal(p ?? 0, c ?? 0, f ?? 0)
}

/**
 * Checks the form. `others` are the person's other foods (a name may not repeat, ignoring case and accents). Empty macros count as 0; with no
 * calories typed, they are the calories the macros add up to.
 */
export function validateFood(form: FoodForm, others: { name: string }[]): { ok: true; values: FoodValues } | { ok: false; errors: FoodErrors } {
  const errors: FoodErrors = {}
  const name = form.name.trim().replace(/\s+/g, " ")
  if (name === "") errors.name = "Informe o nome do alimento."
  else if (name.length > 120) errors.name = "Use no máximo 120 caracteres."
  else if (others.some((o) => plain(o.name) === plain(name))) errors.name = "Você já tem um alimento com esse nome."

  const qty = parseNumber(form.portionQty)
  if (qty === null || Number.isNaN(qty) || qty <= 0) errors.portionQty = "Informe uma porção maior que zero."

  const read = (key: "kcal" | "protein" | "carbs" | "fat" | "fiber", max: number) => {
    const n = parseNumber(form[key])
    if (n !== null && (Number.isNaN(n) || n < 0 || n > max)) {
      errors[key] = `Informe um número entre 0 e ${max}.`
      return 0
    }
    return n
  }
  const kcal = read("kcal", 10000)
  const protein = read("protein", 1000)
  const carbs = read("carbs", 1000)
  const fat = read("fat", 1000)
  const fiber = read("fiber", 1000)
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    values: {
      name,
      serving_label: servingLabel(qty as number, form.unit),
      kcal: kcal ?? approxKcal(protein ?? 0, carbs ?? 0, fat ?? 0),
      protein_g: protein ?? 0,
      carbs_g: carbs ?? 0,
      fat_g: fat ?? 0,
      fiber_g: fiber,
    },
  }
}

/** The form for an existing food (editing): the serving label is split back into quantity and unit when it was made here, else it stays as "1 unidade". */
export function formFromFood(food: { name: string; serving_label: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }, fiber: number | null): FoodForm {
  const text = (n: number) => String(n).replace(".", ",")
  const match = /^([\d.,]+)\s+(.+)$/.exec(food.serving_label)
  const qty = match ? (parseNumber(match[1].replace(/\.(?=\d{3}\b)/g, "")) ?? 1) : 1
  const unit = match ? PORTION_UNITS.find((u) => u.one === match[2] || u.many === match[2]) : undefined
  return { name: food.name, portionQty: text(unit ? qty : 1), unit: unit?.id ?? "unidade", kcal: text(food.kcal), protein: text(food.protein_g), carbs: text(food.carbs_g), fat: text(food.fat_g), fiber: fiber === null ? "" : text(fiber) }
}
