// What the person decides about a goal habit beyond the columns that exist today: the step of its "+" button. localStorage adapter behind
// `HabitMetaRepo`; a habit without an entry uses the default step of its unit. Pure apart from that adapter.

export type HabitMeta = { step?: number }
export type HabitMetaMap = Record<string, HabitMeta>

export interface HabitMetaRepo {
  load(): HabitMetaMap
  save(map: HabitMetaMap): void
}

const KEY = "organizzou:habit-meta"

export function parseHabitMeta(raw: unknown): HabitMetaMap {
  const out: HabitMetaMap = {}
  if (!raw || typeof raw !== "object") return out
  for (const [id, value] of Object.entries(raw as Record<string, { step?: unknown }>)) {
    const step = typeof value?.step === "number" && Number.isFinite(value.step) && value.step > 0 ? value.step : undefined
    if (step !== undefined) out[id] = { step }
  }
  return out
}

export const localHabitMetaRepo: HabitMetaRepo = {
  load() {
    try {
      return parseHabitMeta(JSON.parse(localStorage.getItem(KEY) ?? "{}"))
    } catch {
      return {}
    }
  },
  save(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map))
    } catch {
      // Private mode: the step just does not survive the visit.
    }
  },
}
