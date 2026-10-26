import { shiftDay } from "@/features/habits/stats"
import type {
  ExerciseRow,
  PlanExerciseRow,
  SetLogRow,
  WorkoutPlanRow,
  WorkoutSessionRow,
} from "@/features/workouts/types"

import { dayOf } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"
const stamp = { created_at: "2026-01-05T09:00:00.000Z", updated_at: "2026-01-05T09:00:00.000Z" }

const ex = (n: number, name: string, group: string): ExerciseRow => ({
  id: `x0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  user_id: null,
  name,
  muscle_group: group,
})

export const mockExercises: ExerciseRow[] = [
  ex(1, "Supino reto com barra", "Peito"),
  ex(2, "Supino inclinado com halteres", "Peito"),
  ex(3, "Crucifixo na máquina", "Peito"),
  ex(4, "Tríceps na polia", "Tríceps"),
  ex(5, "Tríceps testa", "Tríceps"),
  ex(6, "Puxada frontal", "Costas"),
  ex(7, "Remada curvada", "Costas"),
  ex(8, "Remada baixa", "Costas"),
  ex(9, "Rosca direta", "Bíceps"),
  ex(10, "Rosca martelo", "Bíceps"),
  ex(11, "Agachamento livre", "Pernas"),
  ex(12, "Leg press 45°", "Pernas"),
  ex(13, "Cadeira extensora", "Pernas"),
  ex(14, "Mesa flexora", "Pernas"),
  ex(15, "Panturrilha em pé", "Panturrilhas"),
]

const plan = (n: number, name: string, weekdays: number[]): WorkoutPlanRow => ({
  id: `p0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
  user_id: USER,
  name,
  weekdays,
  ...stamp,
})

export const mockPlans: WorkoutPlanRow[] = [
  plan(1, "Treino A — Peito e tríceps", [1, 4]),
  plan(2, "Treino B — Costas e bíceps", [2, 5]),
  plan(3, "Treino C — Pernas", [3]),
]

const pe = (plan: number, position: number, exercise: number, sets: number, reps: number, rest: number, load: number | null): PlanExerciseRow => ({
  id: `pe${plan}${String(position).padStart(2, "0")}0000-0000-4000-8000-000000000000`,
  plan_id: mockPlans[plan - 1].id,
  exercise_id: mockExercises[exercise - 1].id,
  position,
  sets,
  reps,
  rest_seconds: rest,
  target_load_kg: load,
})

export const mockPlanExercises: PlanExerciseRow[] = [
  pe(1, 1, 1, 4, 8, 90, 70),
  pe(1, 2, 2, 3, 10, 75, 26),
  pe(1, 3, 3, 3, 12, 60, 40),
  pe(1, 4, 4, 3, 12, 60, 30),
  pe(1, 5, 5, 3, 10, 60, 25),
  pe(2, 1, 6, 4, 10, 75, 55),
  pe(2, 2, 7, 4, 8, 90, 50),
  pe(2, 3, 8, 3, 12, 60, 45),
  pe(2, 4, 9, 3, 10, 60, 20),
  pe(2, 5, 10, 3, 12, 45, 14),
  pe(3, 1, 11, 4, 8, 120, 80),
  pe(3, 2, 12, 4, 12, 90, 160),
  pe(3, 3, 13, 3, 12, 60, 50),
  pe(3, 4, 14, 3, 12, 60, 40),
  pe(3, 5, 15, 4, 15, 45, 60),
]

/** Ten weeks of history on each plan's weekdays, with loads that creep up week by week. */
export function buildMockWorkoutHistory(now: string): { sessions: WorkoutSessionRow[]; sets: SetLogRow[] } {
  const today = dayOf(now)
  const sessions: WorkoutSessionRow[] = []
  const sets: SetLogRow[] = []
  for (let back = 70; back >= 1; back -= 1) {
    const day = shiftDay(today, -back)
    const weekday = new Date(`${day}T12:00:00`).getDay()
    for (const p of mockPlans) {
      if (!p.weekdays.includes(weekday)) continue
      // Skip a few sessions so the frequency chart is not perfectly flat.
      if ((back * 5 + weekday) % 7 === 0) continue
      const id = `s${day.replace(/-/g, "")}${p.id.slice(-2)}-0000-4000-8000-000000000000`
      sessions.push({ id, user_id: USER, plan_id: p.id, performed_on: day, duration_min: 55 + ((back * 3) % 15), completed: true })
      const weeksIn = Math.floor((70 - back) / 7)
      for (const item of mockPlanExercises.filter((e) => e.plan_id === p.id)) {
        for (let index = 1; index <= item.sets; index += 1) {
          const base = item.target_load_kg ?? 20
          sets.push({
            id: `${id}-${item.exercise_id}-${index}`,
            session_id: id,
            exercise_id: item.exercise_id,
            set_index: index,
            reps: index === item.sets ? item.reps - 1 : item.reps,
            load_kg: Math.round((base * (0.85 + weeksIn * 0.02)) / 2.5) * 2.5,
          })
        }
      }
    }
  }
  return { sessions, sets }
}
