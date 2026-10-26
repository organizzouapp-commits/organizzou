// Mirrors the planned `journal_entries` and `sleep_logs` tables (docs/PLAN-PHASE-0.md §4.1).
export type Mood = 1 | 2 | 3 | 4 | 5

export const MOOD_LABELS: Record<Mood, string> = { 1: "Muito mal", 2: "Mal", 3: "Normal", 4: "Bem", 5: "Ótimo" }

export type JournalEntryRow = {
  id: string
  user_id: string
  /** "yyyy-MM-dd" in the user's timezone. */
  entry_date: string
  mood: Mood
  text: string
  sleep_hours: number | null
  created_at: string
  updated_at: string
}

/** What the correlation view needs: the entry plus signals derived from other modules. */
export type JournalDay = JournalEntryRow & { trained: boolean; studied_min: number }
