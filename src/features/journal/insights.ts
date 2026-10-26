import type { JournalDay } from "./types"

export function average(values: number[]) {
  return values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

export type Insight = {
  key: "sleep" | "workout" | "study"
  label: string
  withAvg: number | null
  withoutAvg: number | null
  withCount: number
  withoutCount: number
}

function split(days: JournalDay[], predicate: (day: JournalDay) => boolean) {
  const withSignal = days.filter(predicate).map((d) => d.mood)
  const without = days.filter((d) => !predicate(d)).map((d) => d.mood)
  return { withAvg: average(withSignal), withoutAvg: average(without), withCount: withSignal.length, withoutCount: without.length }
}

/** Average mood on days with vs. without each signal. */
export function moodInsights(days: JournalDay[]): Insight[] {
  return [
    { key: "sleep", label: "dormiu 7 h ou mais", ...split(days, (d) => (d.sleep_hours ?? 0) >= 7) },
    { key: "workout", label: "treinou", ...split(days, (d) => d.trained) },
    { key: "study", label: "estudou 1 h ou mais", ...split(days, (d) => d.studied_min >= 60) },
  ]
}
