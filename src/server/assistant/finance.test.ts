import type { SupabaseClient } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { logToolError, monthBounds, readMonth, summarize, summaryForModel, upcomingBills } from "./finance"
import { toolByName } from "./tools"
import type { Ctx } from "./execute"

type Row = Record<string, unknown>

/** A fake PostgREST client that, like Postgres, rejects a date that does not exist (2026-11-31). Records every filter. */
function fakeDb(tables: Record<string, Row[]>, failTable?: string) {
  const filters: { table: string; op: string; column: string; value: unknown }[] = []
  const realDate = (v: unknown) => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return true
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }
  const from = (table: string) => {
    let rows = tables[table] ?? []
    let error: { code: string; message: string } | null = failTable === table ? { code: "42P01", message: `relation "${table}" does not exist` } : null
    let range: [number, number] | null = null
    const b: Record<string, unknown> = {
      select: () => b,
      order: () => b,
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b),
      gte: (c: string, v: unknown) => {
        filters.push({ table, op: "gte", column: c, value: v })
        if (!realDate(v)) error = { code: "22008", message: `date/time field value out of range: "${v}"` }
        rows = rows.filter((r) => String(r[c]) >= String(v))
        return b
      },
      lt: (c: string, v: unknown) => {
        filters.push({ table, op: "lt", column: c, value: v })
        if (!realDate(v)) error = { code: "22008", message: `date/time field value out of range: "${v}"` }
        rows = rows.filter((r) => String(r[c]) < String(v))
        return b
      },
      lte: (c: string, v: unknown) => {
        filters.push({ table, op: "lte", column: c, value: v })
        if (!realDate(v)) error = { code: "22008", message: `date/time field value out of range: "${v}"` }
        rows = rows.filter((r) => String(r[c]) <= String(v))
        return b
      },
      range: (a: number, z: number) => ((range = [a, z]), b),
      then: (resolve: (v: { data: Row[] | null; error: unknown }) => unknown) => resolve({ data: error ? null : range ? rows.slice(range[0], range[1] + 1) : rows, error }),
    }
    return b
  }
  return { supabase: { from } as unknown as SupabaseClient, filters }
}

const NOW = new Date("2026-11-17T15:00:00Z")
const ctxOf = (supabase: SupabaseClient): Ctx => ({ supabase, userId: "u1", now: NOW })

const categories = [
  { id: "c-mercado", name: "Mercado" },
  { id: "c-lazer", name: "Lazer" },
]
const transactions = [
  { id: "1", kind: "out", amount_cents: 45000, category_id: "c-mercado", occurred_on: "2026-11-03" },
  { id: "2", kind: "out", amount_cents: "12050", category_id: "c-lazer", occurred_on: "2026-11-30" },
  { id: "3", kind: "out", amount_cents: 1000, category_id: null, occurred_on: "2026-11-10" },
  { id: "4", kind: "in", amount_cents: 500000, category_id: null, occurred_on: "2026-11-05" },
  { id: "5", kind: "out", amount_cents: 99900, category_id: "c-mercado", occurred_on: "2026-10-31" },
  { id: "6", kind: "out", amount_cents: 7000, category_id: "c-mercado", occurred_on: "2026-12-01" },
]
const tables = { finance_transactions: transactions, finance_categories: categories }

afterEach(() => vi.restoreAllMocks())

describe("month bounds", () => {
  it("never builds a day that does not exist (the production bug: 2026-11-31)", () => {
    expect(monthBounds("2026-11")).toEqual({ from: "2026-11-01", toExclusive: "2026-12-01" })
    expect(monthBounds("2026-12")).toEqual({ from: "2026-12-01", toExclusive: "2027-01-01" })
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", toExclusive: "2026-03-01" })
    expect(monthBounds("2026-13")).toBeNull()
    expect(monthBounds("novembro")).toBeNull()
  })
})

describe("finance_summary", () => {
  const run = (month: string | undefined, db = fakeDb(tables)) => toolByName("finance_summary")!.run(ctxOf(db.supabase), month ? { month } : {})

  it("the current month (30 days, the case that used to fail): total spent, by category, balance, in pt-BR", async () => {
    const result = await run(undefined)
    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ month: "2026-11", spent: "R$ 580,50", income: "R$ 5.000,00", balance: "R$ 4.419,50", spent_reais: 580.5, transactions: 4 })
    expect((result.data as { by_category: unknown[] }).by_category).toEqual([
      { category: "Mercado", spent: "R$ 450,00", reais: 450 },
      { category: "Lazer", spent: "R$ 120,50", reais: 120.5 },
      { category: "Sem categoria", spent: "R$ 10,00", reais: 10 },
    ])
  })
  it("a given month, and a month where spending is higher than income shows a negative balance", async () => {
    const outubro = await run("2026-10")
    expect(outubro.data).toMatchObject({ month: "2026-10", spent: "R$ 999,00", income: "R$ 0,00", balance: "− R$ 999,00" })
  })
  it("the old query (the last day written as -31) fails on a 30-day month, the new one does not", async () => {
    const old = await fakeDb(tables).supabase.from("finance_transactions").select("x").gte("occurred_on", "2026-11-01").lte("occurred_on", "2026-11-31")
    expect((old as unknown as { error: { code: string } }).error.code).toBe("22008")
    const db = fakeDb(tables)
    await run("2026-11", db)
    expect(db.filters.filter((f) => f.table === "finance_transactions").map((f) => [f.op, f.value])).toEqual([["gte", "2026-11-01"], ["lt", "2026-12-01"]])
  })
  it("a database error is logged in a structured way (no content, no amounts) and the person gets the friendly message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const result = await run("2026-11", fakeDb(tables, "finance_transactions"))
    expect(result).toEqual({ ok: false, message: "Não consegui ler as finanças." })
    const logged = JSON.parse(String(spy.mock.calls[0][0]))
    expect(logged).toMatchObject({ event: "assistant_tool_error", tool: "finance_summary", code: "42P01" })
    expect(Object.keys(logged).sort()).toEqual(["code", "event", "message", "tool"])
  })
  it("pages past 1000 rows instead of silently cutting the month", async () => {
    const many = Array.from({ length: 2300 }, (_, i) => ({ id: String(i).padStart(5, "0"), kind: "out", amount_cents: 100, category_id: null, occurred_on: "2026-11-02" }))
    const result = await readMonth(fakeDb({ finance_transactions: many, finance_categories: [] }).supabase, "2026-11")
    expect(result.ok && result.summary.spent_cents).toBe(230000)
  })
})

describe("pure helpers", () => {
  it("summarize and format", () => {
    const s = summarize("2026-11", [{ kind: "in", amount_cents: 1000, category_id: null }, { kind: "out", amount_cents: 250, category_id: "x" }], new Map([["x", "Café"]]))
    expect(summaryForModel(s)).toMatchObject({ income: "R$ 10,00", spent: "R$ 2,50", balance: "R$ 7,50", by_category: [{ category: "Café", spent: "R$ 2,50" }] })
  })
  it("masks digits in logged messages", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    logToolError("x", { code: "22008", message: 'value "2026-11-31" and 1.234,56' })
    expect(String(spy.mock.calls[0][0])).not.toMatch(/2026|1\.234/)
  })
})

describe("list_bills: upcoming fixed bills", () => {
  const bills = [
    { name: "Aluguel", amount_cents: 150000, due_day: 5, last_paid_month: "2026-11" },
    { name: "Internet", amount_cents: 9990, due_day: 10, last_paid_month: null },
    { name: "Luz", amount_cents: 18000, due_day: 20, last_paid_month: null },
    { name: "Academia", amount_cents: 12000, due_day: 17, last_paid_month: null },
  ]
  it("orders by next due date and tells overdue, due today, upcoming and paid", () => {
    const out = upcomingBills(bills, NOW)
    expect(out.map((b) => [b.name, b.next_due_date, b.status])).toEqual([
      ["Internet", "2026-11-10", "overdue"],
      ["Academia", "2026-11-17", "due_today"],
      ["Luz", "2026-11-20", "upcoming"],
      ["Aluguel", "2026-12-05", "paid_this_month"],
    ])
    expect(out[0]).toMatchObject({ amount: "R$ 99,90", reais: 99.9 })
  })
  it("the tool returns them and logs a failure without content", async () => {
    const ok = await toolByName("list_bills")!.run(ctxOf(fakeDb({ finance_bills: bills }).supabase), {})
    expect(ok.ok).toBe(true)
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const bad = await toolByName("list_bills")!.run(ctxOf(fakeDb({}, "finance_bills").supabase), {})
    expect(bad).toEqual({ ok: false, message: "Não consegui ler as contas." })
    expect(JSON.parse(String(spy.mock.calls[0][0]))).toMatchObject({ tool: "list_bills", code: "42P01" })
  })
})
