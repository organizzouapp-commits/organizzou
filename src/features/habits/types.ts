// Mirrors the planned `habits` and `habit_logs` tables (docs/PLAN-PHASE-0.md §4.1).
export type HabitType = "fixed" | "goal"

export type HabitRow = {
  id: string
  user_id: string
  name: string
  type: HabitType
  /** Daily target for goal habits, e.g. 20 (páginas). Null for fixed habits. */
  target_qty: number | null
  unit: string | null
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: number[]
  deadline: string | null
  paused: boolean
  created_at: string
  updated_at: string
}

export type HabitLogRow = {
  id: string
  user_id: string
  habit_id: string
  /** "yyyy-MM-dd" in the user's timezone. */
  log_date: string
  qty: number
  created_at: string
  updated_at: string
}
