// Pure helpers of the "Provas e prazos" tab of Estudos. Days are "yyyy-MM-dd" strings in America/Sao_Paulo ("today" comes from dayOf(nowIso)),
// and every calculation works on the date parts alone, so the result never depends on the device's timezone or on daylight saving.
import { shiftDay } from "@/features/habits/stats"

import type { DeadlineRow } from "./types"

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]

const parts = (day: string) => {
  const [y, m, d] = day.split("-").map(Number)
  return { y, m, d }
}
const utc = (day: string) => {
  const { y, m, d } = parts(day)
  return Date.UTC(y, m - 1, d)
}
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
const validDay = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Whole days from today to the due day: 0 = today, negative = overdue. Exact (UTC midnights), whatever the device timezone. */
export const daysLeft = (due: string, today: string) => Math.round((utc(due) - utc(today)) / 86_400_000)

// ------------------------------------------------------------------ extra fields (localStorage until the migration is applied)

/** What the screen needs beyond `study_deadlines`: the "Outro" type, the reminders and the done flag. */
export type DeadlineMeta = { other?: boolean; remind?: number[]; done?: boolean }
export type DeadlineMetaMap = Record<string, DeadlineMeta>

/** Until supabase/migrations/20261110000003_deadline_extras.sql is applied (it is only prepared), these live in localStorage behind this interface. */
export type DeadlineMetaRepo = { load(): DeadlineMetaMap; save(map: DeadlineMetaMap): void }

const KEY = "organizzou:estudos-deadline-meta"
export const REMIND_OPTIONS = [
  { days: 1, label: "1 dia" },
  { days: 3, label: "3 dias" },
  { days: 7, label: "1 semana" },
]

export const localDeadlineMetaRepo: DeadlineMetaRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown
      if (!parsed || typeof parsed !== "object") return {}
      const out: DeadlineMetaMap = {}
      for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!value || typeof value !== "object") continue
        const v = value as Record<string, unknown>
        out[id] = { other: v.other === true || undefined, done: v.done === true || undefined, remind: Array.isArray(v.remind) ? v.remind.filter((n): n is number => typeof n === "number") : undefined }
      }
      return out
    } catch {
      return {}
    }
  },
  save(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map))
    } catch {
      // Private mode: the extras just do not survive the visit.
    }
  },
}

export type DeadlineType = "exam" | "delivery" | "other"
export const TYPE_LABELS: Record<DeadlineType, string> = { exam: "Prova", delivery: "Entrega", other: "Outro" }
export const typeOf = (row: Pick<DeadlineRow, "kind">, meta?: DeadlineMeta): DeadlineType => (meta?.other ? "other" : row.kind)

// ------------------------------------------------------------------ grouping

export type GroupId = "week" | "month" | "later" | "done"
export const GROUP_LABELS: Record<GroupId, string> = { week: "Esta semana", month: "Este mês", later: "Depois", done: "Concluídos" }

/** done → Concluídos; up to 7 days from today (overdue included, they are the most urgent) → Esta semana; the rest of the current month → Este mês; anything later → Depois. */
export function groupOf(due: string, today: string, done: boolean): GroupId {
  if (done) return "done"
  if (daysLeft(due, today) <= 7) return "week"
  return due.slice(0, 7) === today.slice(0, 7) ? "month" : "later"
}

export type DeadlineGroup<T> = { id: GroupId; label: string; items: T[] }

/** The groups in display order (empty ones left out). Open items soonest first, completed ones most recent first. */
export function groupDeadlines<T extends Pick<DeadlineRow, "id" | "due_on">>(items: T[], metas: DeadlineMetaMap, today: string): DeadlineGroup<T>[] {
  const buckets: Record<GroupId, T[]> = { week: [], month: [], later: [], done: [] }
  for (const item of items) buckets[groupOf(item.due_on, today, Boolean(metas[item.id]?.done))].push(item)
  const order: GroupId[] = ["week", "month", "later", "done"]
  return order
    .map((id) => ({ id, label: GROUP_LABELS[id], items: [...buckets[id]].sort((a, b) => (id === "done" ? b.due_on.localeCompare(a.due_on) : a.due_on.localeCompare(b.due_on))) }))
    .filter((g) => g.items.length > 0)
}

/** The nearest open deadline from today on. */
export function nextDeadline<T extends Pick<DeadlineRow, "id" | "due_on">>(items: T[], metas: DeadlineMetaMap, today: string): T | null {
  return items.filter((d) => !metas[d.id]?.done && d.due_on >= today).sort((a, b) => a.due_on.localeCompare(b.due_on))[0] ?? null
}

export type DayBlock = { kind: "overdue" | "today" | "soon" | "later"; /** The big text of the block. */ big: string; /** The small text under it. */ small: string; /** Solid Lima: today and up to 3 days left. */ solid: boolean }

/** The 56 px block of a row: "3 / dias" (solid Lima at 3 days or less), "hoje", and "atrasado" for a past day. */
export function dayBlock(left: number): DayBlock {
  if (left < 0) return { kind: "overdue", big: String(Math.abs(left)), small: "atrasado", solid: false }
  if (left === 0) return { kind: "today", big: "hoje", small: "", solid: true }
  return { kind: left <= 3 ? "soon" : "later", big: String(left), small: left === 1 ? "dia" : "dias", solid: left <= 3 }
}

// ------------------------------------------------------------------ formatting and parsing (pt-BR)

/** "quinta-feira, 12 de novembro" */
export function formatLong(day: string): string {
  const { y, m, d } = parts(day)
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} de ${MONTHS[m - 1]}`
}
/** "12 nov" */
export const formatShort = (day: string) => `${parts(day).d} ${MONTHS_SHORT[parts(day).m - 1]}`
/** "12/11/2026" */
export const formatBR = (day: string) => `${String(parts(day).d).padStart(2, "0")}/${String(parts(day).m).padStart(2, "0")}/${parts(day).y}`
/** "novembro de 2026" */
export const monthTitle = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`

const monthIndex = (text: string): number | null => {
  const t = text.toLowerCase().replace(/\./g, "")
  const i = MONTHS.findIndex((name) => name === t || name.slice(0, 3) === t || (t.length >= 3 && name.startsWith(t)))
  return i >= 0 ? i + 1 : null
}

/**
 * Reads a simple pt-BR date: "20 de nov", "20 nov", "20 de novembro de 2026", "20/11", "20/11/2026", "20/11/26", plus "hoje" and "amanhã".
 * Without a year it is the next occurrence (this year, or next year when the day already passed). Null when it is not a date.
 */
export function parseDate(text: string, today: string): string | null {
  const t = text.trim().toLowerCase()
  if (t === "hoje") return today
  if (t === "amanhã" || t === "amanha") return shiftDay(today, 1)
  const { y: ty } = parts(today)
  let day: number
  let month: number | null
  let year: number | null = null
  let m = t.match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2}|\d{4}))?$/)
  if (m) {
    day = Number(m[1])
    month = Number(m[2])
    if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  } else {
    m = t.match(/^(\d{1,2})(?:\s+de)?\s+([a-zç.]+)(?:\s+de)?(?:\s+(\d{4}))?$/)
    if (!m) return null
    day = Number(m[1])
    month = monthIndex(m[2])
    if (m[3]) year = Number(m[3])
  }
  if (month === null || month < 1 || month > 12) return null
  if (year === null) {
    year = ty
    if (validDay(year, month, day) && iso(year, month, day) < today) year += 1
  }
  return validDay(year, month, day) ? iso(year, month, day) : null
}

/** "Prova de Cálculo, 20 de nov" → title + date. The text after the last comma is the date; when it does not parse, the whole text is the title. */
export function parseQuickAdd(text: string, today: string): { title: string; date: string | null } {
  const trimmed = text.trim()
  const cut = trimmed.lastIndexOf(",")
  if (cut > 0) {
    const date = parseDate(trimmed.slice(cut + 1), today)
    const title = trimmed.slice(0, cut).trim()
    if (date && title) return { title, date }
  }
  return { title: trimmed, date: null }
}

// ------------------------------------------------------------------ month calendar

/** The cells of a month grid starting on Sunday: leading blanks as null, then every day of the month. `month` is "yyyy-MM". */
export function monthCells(month: string): (string | null)[] {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [...Array.from({ length: first }, () => null), ...Array.from({ length }, (_, i) => iso(y, m, i + 1))]
}

/** The month before/after "yyyy-MM". */
export function shiftMonth(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}
