import { shiftDay } from "@/features/habits/stats"
import type { HabitLogRow, HabitRow } from "@/features/habits/types"

import { dayOf } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WORK_DAYS = [1, 2, 3, 4, 5]
const stamp = { created_at: "2026-01-05T09:00:00.000Z", updated_at: "2026-01-05T09:00:00.000Z" }

export const mockHabits: HabitRow[] = [
  { id: "h0000000-0000-4000-8000-000000000001", user_id: USER, name: "Beber 2,5 litros de água", type: "goal", target_qty: 2.5, unit: "L", weekdays: ALL_DAYS, deadline: null, paused: false, ...stamp },
  { id: "h0000000-0000-4000-8000-000000000002", user_id: USER, name: "Ler 20 páginas", type: "goal", target_qty: 20, unit: "páginas", weekdays: ALL_DAYS, deadline: null, paused: false, ...stamp },
  { id: "h0000000-0000-4000-8000-000000000003", user_id: USER, name: "Treinar", type: "fixed", target_qty: null, unit: null, weekdays: [1, 2, 4, 5], deadline: null, paused: false, ...stamp },
  { id: "h0000000-0000-4000-8000-000000000004", user_id: USER, name: "Meditar 10 minutos", type: "fixed", target_qty: null, unit: null, weekdays: ALL_DAYS, deadline: null, paused: false, ...stamp },
  { id: "h0000000-0000-4000-8000-000000000005", user_id: USER, name: "Estudar inglês", type: "goal", target_qty: 30, unit: "min", weekdays: WORK_DAYS, deadline: null, paused: false, ...stamp },
  { id: "h0000000-0000-4000-8000-000000000006", user_id: USER, name: "Correr 5 km", type: "fixed", target_qty: null, unit: null, weekdays: [6], deadline: null, paused: true, ...stamp },
]

/** Deterministic pseudo-history: roughly 70% of scheduled days done, today still open. */
export function buildMockHabitLogs(now: string): HabitLogRow[] {
  const today = dayOf(now)
  const logs: HabitLogRow[] = []
  mockHabits.forEach((habit, habitIndex) => {
    for (let i = 1; i <= 90; i += 1) {
      const day = shiftDay(today, -i)
      const weekday = new Date(`${day}T12:00:00`).getDay()
      if (!habit.weekdays.includes(weekday)) continue
      // A longer run of recent days makes streaks look realistic.
      const done = i <= habitIndex + 3 || (i * 7 + habitIndex * 13) % 10 < 7
      if (!done) continue
      logs.push({
        id: `${habit.id}-${day}`,
        user_id: USER,
        habit_id: habit.id,
        log_date: day,
        qty: habit.type === "goal" ? (habit.target_qty ?? 1) : 1,
        created_at: stamp.created_at,
        updated_at: stamp.updated_at,
      })
    }
  })
  // Today: a couple of habits already checked, goals partially done.
  const todayLog = (habitIndex: number, qty: number) => {
    const habit = mockHabits[habitIndex]
    logs.push({ id: `${habit.id}-${today}`, user_id: USER, habit_id: habit.id, log_date: today, qty, created_at: stamp.created_at, updated_at: stamp.updated_at })
  }
  todayLog(0, 1.5)
  todayLog(3, 1)
  return logs
}
