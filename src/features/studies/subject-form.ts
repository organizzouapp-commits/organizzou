// The weekly goal field of the subject sheet: hours as typed ("4", "2,5") <-> minutes as stored.
export const MAX_GOAL_HOURS = 168

/** "2,5" -> 150. Blank or junk is null; the value is capped at a whole week (168 h) and rounded to the minute. */
export function weeklyGoalMinutes(text: string): number | null {
  const clean = text.trim().replace(",", ".")
  if (!/^\d+(\.\d+)?$/.test(clean)) return null
  return Math.round(Math.min(MAX_GOAL_HOURS, Number(clean)) * 60)
}

/** 150 -> "2,5"; 240 -> "4". */
export const goalHoursText = (minutes: number): string => String(Math.round((minutes / 60) * 100) / 100).replace(".", ",")
