// The optional note of a weigh-in. `weight_logs` has no note column yet (supabase/migrations/20261110000001_weight_note.sql is prepared,
// NOT applied), so the notes live in localStorage behind the same interface a Supabase adapter will implement. Keyed by day.
export type WeightNoteRepo = {
  load(): Record<string, string>
  save(notes: Record<string, string>): void
}

const KEY = "organizzou:dieta-weight-notes"

export const localWeightNoteRepo: WeightNoteRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown
      if (!parsed || typeof parsed !== "object") return {}
      return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"))
    } catch {
      return {}
    }
  },
  save(notes) {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes))
    } catch {
      // Private mode: the note just does not survive the visit.
    }
  },
}
