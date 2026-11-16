// Finding an exercise by typing its name: accent-insensitive, names that START with the text first, then names that CONTAIN it. When nothing
// matches exactly, the first option offers to create the typed name as a custom exercise. Pure.

export type NamedExercise = { id: string; name: string }

export const foldName = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

export type ExerciseOption = { kind: "existing"; id: string; name: string } | { kind: "create"; name: string }

/** The options for what was typed: an offer to create first (only when no exercise has exactly that name), then prefix matches, then contains. */
export function exerciseOptions(catalog: NamedExercise[], typed: string, limit = 8): ExerciseOption[] {
  const query = foldName(typed)
  if (!query) return catalog.slice(0, limit).map((e) => ({ kind: "existing", id: e.id, name: e.name }))
  const prefix: NamedExercise[] = []
  const contains: NamedExercise[] = []
  for (const exercise of catalog) {
    const name = foldName(exercise.name)
    if (name.startsWith(query)) prefix.push(exercise)
    else if (name.includes(query)) contains.push(exercise)
  }
  const exact = catalog.some((e) => foldName(e.name) === query)
  const found = [...prefix, ...contains].slice(0, limit).map((e): ExerciseOption => ({ kind: "existing", id: e.id, name: e.name }))
  return exact ? found : [{ kind: "create", name: typed.trim().replace(/\s+/g, " ").slice(0, 120) }, ...found]
}

/** The catalog exercise whose name is exactly the typed one (ignoring case and accents), if any. */
export const exactExercise = (catalog: NamedExercise[], typed: string): NamedExercise | null => catalog.find((e) => foldName(e.name) === foldName(typed)) ?? null
