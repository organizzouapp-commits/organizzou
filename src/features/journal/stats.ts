// Pure helpers of the "Diário" screen: the period numbers, the data of the two charts, the insights texts and the list pagination.
// Days are "yyyy-MM-dd" strings in America/Sao_Paulo ("today" comes from dayOf(nowIso)).
import { shiftDay } from "@/features/habits/stats"
import { bestStreak, currentStreak } from "@/features/studies/stats"

import { average } from "./insights"
import { MOOD_LABELS, type JournalEntryRow, type Mood } from "./types"

type Entry = Pick<JournalEntryRow, "entry_date" | "mood" | "sleep_hours">

export const JOURNAL_PERIODS = [7, 30, 90] as const
export type JournalPeriod = (typeof JOURNAL_PERIODS)[number]

/** The default sleep goal (hours) until the person sets another one. */
export const DEFAULT_SLEEP_GOAL = 7.5
/** How many check-ins the insights need before they say anything. */
export const MIN_INSIGHT_DAYS = 14

// ------------------------------------------------------------------ sleep goal (localStorage until there is a settings column)

export type JournalSettings = { sleepGoal: number }
/** Until the profile settings have a sleep goal column, it lives in localStorage behind this interface. */
export type JournalSettingsRepo = { load(): JournalSettings; save(settings: JournalSettings): void }

const KEY = "organizzou:diario-settings"

export const localJournalSettingsRepo: JournalSettingsRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { sleepGoal?: unknown }
      const goal = typeof parsed.sleepGoal === "number" && parsed.sleepGoal > 0 && parsed.sleepGoal <= 14 ? parsed.sleepGoal : DEFAULT_SLEEP_GOAL
      return { sleepGoal: goal }
    } catch {
      return { sleepGoal: DEFAULT_SLEEP_GOAL }
    }
  },
  save(settings) {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // Private mode: the goal just does not survive the visit.
    }
  },
}

// ------------------------------------------------------------------ period numbers

/** The check-ins of the last `days` days (today included), oldest first. */
export function periodEntries<T extends Pick<JournalEntryRow, "entry_date">>(entries: T[], today: string, days: number): T[] {
  const since = shiftDay(today, -(days - 1))
  return entries.filter((e) => e.entry_date >= since && e.entry_date <= today).sort((a, b) => a.entry_date.localeCompare(b.entry_date))
}

/** Average mood (one decimal) of the check-ins; null without any. */
export const moodAverage = (entries: Pick<Entry, "mood">[]): number | null => average(entries.map((e) => e.mood))

/** Average sleep (one decimal) over the check-ins that have it, and how much of the goal that is (0–100, capped). */
export function sleepAverage(entries: Pick<Entry, "sleep_hours">[], goal: number): { average: number | null; percent: number } {
  const hours = entries.map((e) => e.sleep_hours ?? 0).filter((h) => h > 0)
  const avg = average(hours)
  return { average: avg, percent: avg === null || !(goal > 0) ? 0 : Math.min(100, Math.round((avg / goal) * 100)) }
}

/** Consecutive days with a check-in, counted back from today (or yesterday while today is still empty), and the longest run in the history. */
export function checkinStreak(entries: Pick<Entry, "entry_date">[], today: string): { current: number; record: number } {
  const days = new Set(entries.map((e) => e.entry_date))
  const current = currentStreak(days, today)
  return { current, record: Math.max(bestStreak(days), current) }
}

// ------------------------------------------------------------------ chart data

export type DayPoint = { day: string; mood: Mood | null; sleep: number | null }

/** One point per day of the period (oldest first); days without a check-in have null values. */
export function dailyPoints(entries: Entry[], today: string, days: number): DayPoint[] {
  const byDay = new Map(entries.map((e) => [e.entry_date, e]))
  return Array.from({ length: days }, (_, i) => shiftDay(today, -(days - 1 - i))).map((day) => {
    const entry = byDay.get(day)
    return { day, mood: entry ? entry.mood : null, sleep: entry && entry.sleep_hours !== null && entry.sleep_hours > 0 ? entry.sleep_hours : null }
  })
}

/** The line of the mood chart as runs of consecutive days: a day without a check-in ends the run, so the line is never drawn across a gap. */
export function lineSegments(points: DayPoint[]): { index: number; mood: Mood }[][] {
  const runs: { index: number; mood: Mood }[][] = []
  let current: { index: number; mood: Mood }[] = []
  points.forEach((p, index) => {
    if (p.mood === null) {
      if (current.length > 0) runs.push(current)
      current = []
    } else current.push({ index, mood: p.mood })
  })
  if (current.length > 0) runs.push(current)
  return runs
}

/** Which x labels to show: every `step`-th day counted back from the last one, so the last day is always labelled. */
export function labelIndices(n: number, step: number): number[] {
  return Array.from({ length: n }, (_, i) => i).filter((i) => (n - 1 - i) % step === 0)
}

/** The step between x labels of the mood chart: every day for a week, about every 5 days for a month, then sparser. */
export const moodLabelStep = (days: number) => (days <= 7 ? 1 : days <= 30 ? 5 : 15)

/** Four evenly spread positions (start, a third, two thirds, end) of the sleep chart's x axis. */
export function spreadIndices(n: number): number[] {
  if (n <= 1) return [0]
  return [...new Set([0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1])]
}

/** The top of the sleep chart's y axis: 10 h, or the next multiple of 5 above the largest night. */
export const sleepAxisMax = (values: (number | null)[]) => Math.max(10, Math.ceil(Math.max(0, ...values.map((v) => v ?? 0)) / 5) * 5)

// ------------------------------------------------------------------ texts

const num = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** "4,0", or "—" without a value. */
export const formatMood = (value: number | null) => (value === null ? "—" : num(value))

/** The difference of two averages with an explicit sign and a decimal comma: "+0,9", "−0,3", "0,0"; null when one side is missing. */
export function formatDiff(withAvg: number | null, withoutAvg: number | null): string | null {
  if (withAvg === null || withoutAvg === null) return null
  const diff = Math.round((withAvg - withoutAvg) * 10) / 10
  if (diff === 0) return "0,0"
  return `${diff > 0 ? "+" : "−"}${num(Math.abs(diff))}`
}

/** "Bem (4)" */
export const moodText = (mood: Mood) => `${MOOD_LABELS[mood]} (${mood})`

/** Sleep as written on the screen: "7 h", "7,5 h". */
export const sleepText = (hours: number) => `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`

// ------------------------------------------------------------------ insights rule

/** The insights need at least 14 check-ins: how many are missing (0 when there are enough). */
export function insightsProgress(checkins: number): { enough: boolean; missing: number; total: number } {
  return { enough: checkins >= MIN_INSIGHT_DAYS, missing: Math.max(0, MIN_INSIGHT_DAYS - checkins), total: MIN_INSIGHT_DAYS }
}

// ------------------------------------------------------------------ list

/** The entries of the "Últimos registros" list, newest first: `initial` of them at first and `step` more for every "Ver mais". */
export function visibleEntries<T extends Pick<JournalEntryRow, "entry_date">>(entries: T[], initial: number, step: number, extraPages: number): { items: T[]; hasMore: boolean; remaining: number } {
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  const count = initial + step * extraPages
  return { items: sorted.slice(0, count), hasMore: sorted.length > count, remaining: Math.max(0, sorted.length - count) }
}

// ------------------------------------------------------------------ mood picker keyboard

/** The mood a radio group moves to for an arrow key (wrapping around); null for any other key. Home and End go to the ends. */
export function nextMood(current: Mood | null, key: string): Mood | null {
  const from = current ?? 3
  if (key === "ArrowRight" || key === "ArrowDown") return (from === 5 ? 1 : from + 1) as Mood
  if (key === "ArrowLeft" || key === "ArrowUp") return (from === 1 ? 5 : from - 1) as Mood
  if (key === "Home") return 1
  if (key === "End") return 5
  return null
}

// ------------------------------------------------------------------ chart labels

export type Box = { x1: number; x2: number; y1: number; y2: number }

/**
 * Where the "média" / "meta" label of a chart goes so it does not sit on the data: the first candidate x whose label box touches none of
 * the obstacles (the sampled line, the bars); when every spot is taken, the one touching the fewest. `y1`..`y2` is the vertical extent of the label.
 */
export function pickLabelX(candidates: number[], width: number, y1: number, y2: number, obstacles: Box[]): number {
  let best = candidates[0]
  let bestHits = Infinity
  for (const x of candidates) {
    const hits = obstacles.filter((o) => o.x1 < x + width && o.x2 > x && o.y1 < y2 && o.y2 > y1).length
    if (hits < bestHits) {
      best = x
      bestHits = hits
    }
    if (hits === 0) break
  }
  return best
}

/** Points along straight segments (every `step` px of x), as small boxes: what a line occupies for label placement. */
export function sampleLine(points: { x: number; y: number }[], step = 4, radius = 4): Box[] {
  const boxes: Box[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    boxes.push({ x1: a.x - radius, x2: a.x + radius, y1: a.y - radius, y2: a.y + radius })
    const b = points[i + 1]
    if (!b) continue
    const steps = Math.max(1, Math.floor(Math.abs(b.x - a.x) / step))
    for (let k = 1; k < steps; k++) {
      const t = k / steps
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      boxes.push({ x1: x - radius, x2: x + radius, y1: y - radius, y2: y + radius })
    }
  }
  return boxes
}

/** Like pickLabelX, but the label may also sit under the line: the first free spot above, else the first free one below, else the least crowded. Text baseline offsets: above = line − 6, below = line + 15. */
export function pickLabelSpot(candidates: number[], width: number, lineY: number, obstacles: Box[]): { x: number; side: "above" | "below" } {
  const hitsAt = (x: number, y1: number, y2: number) => obstacles.filter((o) => o.x1 < x + width && o.x2 > x && o.y1 < y2 && o.y2 > y1).length
  let best = { x: candidates[0], side: "above" as "above" | "below", hits: Infinity }
  for (const side of ["above", "below"] as const) {
    const [y1, y2] = side === "above" ? [lineY - 20, lineY - 3] : [lineY + 3, lineY + 20]
    for (const x of candidates) {
      const hits = hitsAt(x, y1, y2)
      if (hits < best.hits) best = { x, side, hits }
      if (hits === 0) return { x, side }
    }
  }
  return { x: best.x, side: best.side }
}
