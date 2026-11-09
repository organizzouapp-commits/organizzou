// Which groups of "Hábitos de hoje" are collapsed. Until a preferences column exists this lives in localStorage behind the same
// interface a Supabase adapter will implement (one row per user, additive; nothing is migrated or pushed).
export type HabitGroupId = "hoje" | "concluidos" | "folga" | "pausados"

export type HabitGroupRepo = {
  /** Group ids the person opened or closed explicitly; a missing id means "use the default". */
  load(): Partial<Record<HabitGroupId, boolean>>
  save(state: Partial<Record<HabitGroupId, boolean>>): void
}

/** Pausados and the days off start collapsed. */
export const DEFAULT_OPEN: Record<HabitGroupId, boolean> = { hoje: true, concluidos: true, folga: false, pausados: false }

const KEY = "organizzou:rotina-groups"

export const localHabitGroupRepo: HabitGroupRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown
      if (!parsed || typeof parsed !== "object") return {}
      const out: Partial<Record<HabitGroupId, boolean>> = {}
      for (const id of Object.keys(DEFAULT_OPEN) as HabitGroupId[]) {
        const value = (parsed as Record<string, unknown>)[id]
        if (typeof value === "boolean") out[id] = value
      }
      return out
    } catch {
      return {}
    }
  },
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}
