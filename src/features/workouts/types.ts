// Mirrors the planned workout tables (docs/PLAN-PHASE-0.md §4.1).
export type ExerciseRow = {
  id: string
  user_id: string | null
  name: string
  muscle_group: string
}

export type WorkoutPlanRow = {
  id: string
  user_id: string
  name: string
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: number[]
  created_at: string
  updated_at: string
}

export type PlanExerciseRow = {
  id: string
  plan_id: string
  exercise_id: string
  position: number
  sets: number
  reps: number
  rest_seconds: number
  /** Suggested starting load. */
  target_load_kg: number | null
}

export type WorkoutSessionRow = {
  id: string
  user_id: string
  plan_id: string
  /** "yyyy-MM-dd" */
  performed_on: string
  duration_min: number | null
  completed: boolean
}

export type SetLogRow = {
  id: string
  session_id: string
  exercise_id: string
  set_index: number
  reps: number
  load_kg: number
}
