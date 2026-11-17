import type { SupabaseClient } from "@supabase/supabase-js"

import { formatBRL } from "@/lib/money"
import { dayOf } from "@/lib/sp-time"

/**
 * What the assistant reads from Finanças. Same tables as the Finanças screen (finance_transactions, finance_categories, finance_bills),
 * on the person's own session (RLS). No "server-only" import so it is easy to test with a fake client.
 */

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** First day of the month and the first day of the NEXT month ("2026-11" -> 2026-11-01 and 2026-12-01). Never an invalid date like 2026-11-31. */
export function monthBounds(month: string): { from: string; toExclusive: string } | null {
  if (!MONTH.test(month)) return null
  const [y, m] = month.split("-").map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
  return { from: `${month}-01`, toExclusive: `${next}-01` }
}

/** A failure of a tool, structured for the Vercel logs: the tool, the database code and a short technical message. No user content, no amounts. */
export function logToolError(tool: string, error: unknown) {
  const e = (error ?? {}) as { code?: unknown; message?: unknown }
  // Digits are masked so a value echoed by the database never reaches the logs.
  const message = typeof e.message === "string" ? e.message.replace(/\d[\d.,-]*/g, "#").slice(0, 160) : "unknown"
  console.error(JSON.stringify({ event: "assistant_tool_error", tool, code: typeof e.code === "string" ? e.code : null, message }))
}

type Tx = { kind: string; amount_cents: number; category_id: string | null }
const PAGE = 1000
const MAX_PAGES = 10

export type MonthSummary = {
  month: string
  income_cents: number
  spent_cents: number
  balance_cents: number
  by_category: { category: string; cents: number }[]
  transactions: number
}

/** Month totals computed from the rows (pure). */
export function summarize(month: string, rows: Tx[], names: Map<string, string>): MonthSummary {
  let income = 0
  let spent = 0
  const byCategory = new Map<string, number>()
  for (const r of rows) {
    if (r.kind === "in") income += r.amount_cents
    else {
      spent += r.amount_cents
      const name = (r.category_id && names.get(r.category_id)) || "Sem categoria"
      byCategory.set(name, (byCategory.get(name) ?? 0) + r.amount_cents)
    }
  }
  return {
    month,
    income_cents: income,
    spent_cents: spent,
    balance_cents: income - spent,
    by_category: [...byCategory].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
    transactions: rows.length,
  }
}

/** What the model receives: amounts as numbers (reais) AND already formatted in pt-BR, so it never has to format money itself. */
export function summaryForModel(s: MonthSummary) {
  return {
    month: s.month,
    income: formatBRL(s.income_cents),
    spent: formatBRL(s.spent_cents),
    balance: s.balance_cents < 0 ? `− ${formatBRL(-s.balance_cents)}` : formatBRL(s.balance_cents),
    income_reais: s.income_cents / 100,
    spent_reais: s.spent_cents / 100,
    balance_reais: s.balance_cents / 100,
    transactions: s.transactions,
    by_category: s.by_category.map((c) => ({ category: c.category, spent: formatBRL(c.cents), reais: c.cents / 100 })),
  }
}

export async function readMonth(supabase: SupabaseClient, month: string): Promise<{ ok: true; summary: MonthSummary } | { ok: false; error: unknown }> {
  const bounds = monthBounds(month)
  if (!bounds) return { ok: false, error: { code: "bad_month", message: "invalid month" } }
  const rows: Tx[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("kind, amount_cents, category_id")
      .gte("occurred_on", bounds.from)
      .lt("occurred_on", bounds.toExclusive)
      .order("occurred_on")
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) return { ok: false, error }
    const batch = (data ?? []) as Tx[]
    // amount_cents is a bigint column: PostgREST may send it as a string.
    rows.push(...batch.map((r) => ({ ...r, amount_cents: Number(r.amount_cents) })))
    if (batch.length < PAGE) break
  }
  const categories = await supabase.from("finance_categories").select("id, name")
  if (categories.error) return { ok: false, error: categories.error }
  const names = new Map(((categories.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]))
  return { ok: true, summary: summarize(month, rows, names) }
}

type Bill = { name: string; amount_cents: number; due_day: number; last_paid_month: string | null }

/** Fixed bills ordered by the next due date: unpaid ones due this month (overdue when the day has passed), paid ones roll to next month. */
export function upcomingBills(bills: Bill[], now: Date) {
  const today = dayOf(now, 0)
  const month = today.slice(0, 7)
  const day = Number(today.slice(8, 10))
  const nextMonth = monthBounds(month)!.toExclusive.slice(0, 7)
  return bills
    .map((b) => {
      const paid = b.last_paid_month === month
      const dueDay = Number(b.due_day)
      const due = `${paid ? nextMonth : month}-${String(dueDay).padStart(2, "0")}`
      const status = paid ? "paid_this_month" : dueDay < day ? "overdue" : dueDay === day ? "due_today" : "upcoming"
      const cents = Number(b.amount_cents)
      return { name: b.name, amount: formatBRL(cents), reais: cents / 100, due_day: dueDay, next_due_date: due, status }
    })
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date) || a.name.localeCompare(b.name))
}
