import { at } from "./time"

export type ScheduleSlot = { id: string; title: string; start: string; end: string; detail: string }

type Template = { weekdays: number[]; time: string; minutes: number; title: string; detail: string }

/** Workout plan days. Names match the plans in src/mocks/workouts.ts. */
export const workoutTemplates: Template[] = [
  { weekdays: [1, 4], time: "07:00", minutes: 60, title: "Treino A — Peito e tríceps", detail: "Academia Smart Fit" },
  { weekdays: [2, 5], time: "07:00", minutes: 60, title: "Treino B — Costas e bíceps", detail: "Academia Smart Fit" },
  { weekdays: [3], time: "18:30", minutes: 60, title: "Treino C — Pernas", detail: "Academia Smart Fit" },
]

/** Weekly study blocks. Subjects match src/mocks/studies.ts. */
export const studyTemplates: Template[] = [
  { weekdays: [1, 3], time: "20:00", minutes: 90, title: "Direito Constitucional", detail: "Bloco de estudo" },
  { weekdays: [2, 4], time: "20:00", minutes: 60, title: "Estatística", detail: "Bloco de estudo" },
  { weekdays: [6], time: "09:00", minutes: 120, title: "Metodologia Científica", detail: "Bloco de estudo" },
]

function expand(prefix: string, templates: Template[], now: string, weeksBack = 6, weeksAhead = 6): ScheduleSlot[] {
  const slots: ScheduleSlot[] = []
  for (let offset = -weeksBack * 7; offset <= weeksAhead * 7; offset += 1) {
    const start = at(now, offset, "00:00")
    const weekday = new Date(at(now, offset, "12:00")).getUTCDay()
    // getUTCDay of noon São Paulo (15:00Z) is the São Paulo weekday.
    for (const template of templates) {
      if (!template.weekdays.includes(weekday)) continue
      const from = at(now, offset, template.time)
      const until = new Date(new Date(from).getTime() + template.minutes * 60_000).toISOString()
      slots.push({ id: `${prefix}-${start}-${template.title}`, title: template.title, start: from, end: until, detail: template.detail })
    }
  }
  return slots
}

export function mockWorkoutSlots(now: string) {
  return expand("workout", workoutTemplates, now)
}

export function mockStudySlots(now: string) {
  return expand("study", studyTemplates, now)
}
