// A savings goal has a start AND an end date, and may start with money already saved ("Quanto já guardei"). That opening balance is one
// entry flagged as such: it counts in "Guardado nas metas", the progress and the projection, and it is never a lançamento (so it never
// touches the month's income, expenses or cash flow). Kept in localStorage behind `GoalMetaRepo` until
// supabase/migrations/20261112000004_goal_start_and_opening.sql is applied (prepared, NOT applied). Pure apart from that adapter.
import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

export type GoalMeta = {
  /** "yyyy-MM-dd"; without it the goal started when it was created. */
  startDate?: string
  /** What was already saved when the goal was created (the "Saldo inicial"), in cents. */
  openingCents?: number
}
export type GoalMetaMap = Record<string, GoalMeta>

/** The day the goal started: the saved start date, else the day it was created. */
export const goalStart = (goal: { created_at: string }, meta?: GoalMeta) => meta?.startDate ?? goal.created_at.slice(0, 10)

export type GoalDateCheck = { start: string | null; end: string | null }

/** pt-BR messages for the dates of the form: the end must come after the start. Empty end is fine (a goal may have no deadline). */
export function validateGoalDates(start: string, end: string): GoalDateCheck {
  const ISO = /^\d{4}-\d{2}-\d{2}$/
  if (!ISO.test(start)) return { start: "Escolha a data de início.", end: null }
  if (end && !ISO.test(end)) return { start: null, end: "Escolha o prazo final." }
  if (end && end <= start) return { start: null, end: "O prazo final precisa ser depois da data de início." }
  return { start: null, end: null }
}

/** Months the remaining amount is spread over: from the later of today and the start, to the end (at least one). */
export function monthsToGo(today: string, start: string, end: string): number {
  const from = start > today ? start : today
  return Math.max(1, Math.ceil(differenceInCalendarDays(parseISO(end), parseISO(from)) / 30))
}

/** What to save per month to reach the target by the end date, counting only the time still ahead. */
export function monthlyNeeded(remainingCents: number, today: string, start: string, end: string): number {
  return remainingCents <= 0 ? 0 : Math.ceil(remainingCents / monthsToGo(today, start, end))
}

const monthYear = (day: string) => format(parseISO(day), "MMM/yyyy", { locale: ptBR }).replace(".", "")

/** "De mar/2026 até jan/2027"; just the end ("Até jan/2027") or "Sem prazo" when a date is missing. */
export function periodLabel(start: string | null, end: string | null): string {
  if (!end) return "Sem prazo"
  return start ? `De ${monthYear(start)} até ${monthYear(end)}` : `Até ${monthYear(end)}`
}

/** The goal's saved amount after the opening balance changed from `previous` to `next`: only that one entry moves, the rest stays. */
export const withOpening = (currentCents: number, previous: number, next: number) => Math.max(0, currentCents - previous + next)

export const shiftMonths = (day: string, months: number) => format(addMonths(parseISO(day), months), "yyyy-MM-dd")

// ---------------------------------------------------------------- storage (fallback until the migration is applied)

export interface GoalMetaRepo {
  load(): GoalMetaMap
  save(map: GoalMetaMap): void
}

const KEY = "organizzou:financas-goal-meta"

export function parseGoalMeta(raw: unknown): GoalMetaMap {
  const out: GoalMetaMap = {}
  if (!raw || typeof raw !== "object") return out
  for (const [id, value] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    if (!value || typeof value !== "object") continue
    const startDate = typeof value.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.startDate) ? value.startDate : undefined
    const openingCents = Number.isInteger(value.openingCents) && (value.openingCents as number) > 0 ? (value.openingCents as number) : undefined
    if (startDate || openingCents) out[id] = { startDate, openingCents }
  }
  return out
}

export const localGoalMetaRepo: GoalMetaRepo = {
  load() {
    try {
      return parseGoalMeta(JSON.parse(localStorage.getItem(KEY) ?? "{}"))
    } catch {
      return {}
    }
  },
  save(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map))
    } catch {
      // Private mode: the dates just do not survive the visit.
    }
  },
}
