// The per-account assistant cost view, apart from the database and the page: periods, search, sorting, totals, the month projection and the
// budget state. Pure, so the math is tested. Counts and tokens only: no message content ever reaches this module.
import { costUsd, type TokenCount } from "@/lib/assistant-pricing"

export type Period = "today" | "d7" | "month" | "total"
export const PERIODS: { value: Period; label: string; slug: string }[] = [
  { value: "today", label: "Hoje", slug: "hoje" },
  { value: "d7", label: "7 dias", slug: "7d" },
  { value: "month", label: "Mês", slug: "mes" },
  { value: "total", label: "Total", slug: "total" },
]
export const periodFromSlug = (slug: string | undefined): Period => PERIODS.find((p) => p.slug === slug)?.value ?? "month"
export const slugOfPeriod = (period: Period) => PERIODS.find((p) => p.value === period)!.slug

export type Figures = { messages: number; input: number; output: number }
/** One account as the database function returns it. */
export type CostRow = {
  user_id: string
  email: string
  name: string | null
  plan: "free" | "pro"
  /** ISO instant of the last use, or null. */
  last_use: string | null
  today: Figures
  d7: Figures
  month: Figures
  total: Figures
}

export type CostLine = { row: CostRow; shown: Figures; costUsd: number; monthCostUsd: number; totalCostUsd: number; todayMessages: number; monthMessages: number }

const tokens = (f: Figures): TokenCount => ({ input: f.input, output: f.output })
const sum = (a: Figures, b: Figures): Figures => ({ messages: a.messages + b.messages, input: a.input + b.input, output: a.output + b.output })
export const ZERO: Figures = { messages: 0, input: 0, output: 0 }

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Rows for one period, filtered by a search of name or e-mail (accent-insensitive), sorted by the cost of that period (then by messages). */
export function costLines(rows: CostRow[], period: Period, search: string): CostLine[] {
  const q = norm(search.trim())
  return rows
    .filter((row) => !q || norm(row.email).includes(q) || norm(row.name ?? "").includes(q))
    .map((row) => {
      const shown = row[period]
      return { row, shown, costUsd: costUsd(tokens(shown)), monthCostUsd: costUsd(tokens(row.month)), totalCostUsd: costUsd(tokens(row.total)), todayMessages: row.today.messages, monthMessages: row.month.messages }
    })
    .sort((a, b) => b.costUsd - a.costUsd || b.shown.messages - a.shown.messages || a.row.email.localeCompare(b.row.email))
}

/** The total row for the period, over the lines shown. */
export function totalsOf(lines: CostLine[]): { shown: Figures; costUsd: number; monthCostUsd: number; totalCostUsd: number } {
  const shown = lines.reduce((acc, l) => sum(acc, l.shown), ZERO)
  return { shown, costUsd: costUsd(tokens(shown)), monthCostUsd: lines.reduce((a, l) => a + l.monthCostUsd, 0), totalCostUsd: lines.reduce((a, l) => a + l.totalCostUsd, 0) }
}

/** Month-to-date cost over ALL accounts (the figure the budget is compared with), whatever the search. */
export const monthSpendUsd = (rows: CostRow[]): number => rows.reduce((a, r) => a + costUsd(tokens(r.month)), 0)

/** Days of the month (yyyy-MM-dd, São Paulo): elapsed counting today, and total. */
export function monthDays(today: string): { elapsed: number; total: number } {
  const [y, m, d] = today.split("-").map(Number)
  return { elapsed: d, total: new Date(Date.UTC(y, m, 0)).getUTCDate() }
}

/** The month projected at the pace so far: spent / days elapsed * days in the month. Null on a day-one with nothing spent. */
export function projectMonth(spentUsd: number, today: string): number | null {
  const { elapsed, total } = monthDays(today)
  if (elapsed <= 0) return null
  return (spentUsd / elapsed) * total
}

export type BudgetState = { state: "none" | "ok" | "warning" | "exceeded"; ratio: number | null }

/** "ok" below 80%, "warning" from 80% up to the budget, "exceeded" above it. No budget: "none". */
export function budgetState(spentUsd: number, budgetUsd: number | null): BudgetState {
  if (budgetUsd == null || !(budgetUsd > 0)) return { state: "none", ratio: null }
  const ratio = spentUsd / budgetUsd
  return { state: ratio > 1 ? "exceeded" : ratio >= 0.8 ? "warning" : "ok", ratio }
}

/** A budget typed by the admin or read from the environment: a positive number (comma or dot), else null. */
export function parseBudget(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."))
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null
}

/** The database answer is untyped JSON: keep only well-formed rows, with numbers as numbers. */
export function parseCostRows(raw: unknown): CostRow[] {
  if (!Array.isArray(raw)) return []
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0)
  const figures = (v: unknown): Figures => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>
    return { messages: num(o.messages), input: num(o.input), output: num(o.output) }
  }
  return raw.flatMap((item) => {
    const o = item as Record<string, unknown> | null
    if (!o || typeof o.user_id !== "string") return []
    return [{ user_id: o.user_id, email: typeof o.email === "string" ? o.email : "", name: typeof o.name === "string" ? o.name : null, plan: o.plan === "pro" ? ("pro" as const) : ("free" as const), last_use: typeof o.last_use === "string" ? o.last_use : null, today: figures(o.today), d7: figures(o.d7), month: figures(o.month), total: figures(o.total) }]
  })
}
