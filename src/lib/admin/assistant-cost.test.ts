import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ writes: 0, admin: false }))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))
vi.mock("@/lib/admin/guard", () => ({
  requireAdminForAction: async () => {
    if (!state.admin) throw new Error("NEXT_HTTP_ERROR_FALLBACK;404")
    return { adminId: "admin-1", email: "admin@exemplo.com", supabase: {} }
  },
}))
vi.mock("@/lib/admin/secret", () => ({
  SECRET_KEY_HINT: "falta a chave",
  secretKeyConfigured: () => true,
  createSecretClient: () => {
    const write = async () => (state.writes++, { error: null })
    return { from: () => ({ upsert: write, delete: () => ({ eq: write }), insert: write }) }
  },
}))


import { ASSISTANT_PRICING, costUsd, formatBrl, formatUsd, USD_TO_BRL, usdToBrl } from "@/lib/assistant-pricing"

import { budgetState, costLines, monthDays, monthSpendUsd, parseBudget, parseCostRows, periodFromSlug, projectMonth, totalsOf, type CostRow } from "./assistant-cost"

const fig = (messages: number, input: number, output: number) => ({ messages, input, output })
const row = (over: Partial<CostRow> & { user_id: string; email: string }): CostRow => ({ name: null, plan: "pro", last_use: null, today: fig(0, 0, 0), d7: fig(0, 0, 0), month: fig(0, 0, 0), total: fig(0, 0, 0), ...over })

describe("cost math", () => {
  it("prices tokens per million with the configured defaults (haiku: US$ 0,10 in, US$ 0,50 out)", () => {
    expect(ASSISTANT_PRICING).toMatchObject({ model: "claude-haiku-5-5", inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 })
    expect(costUsd({ input: 1_000_000, output: 0 })).toBeCloseTo(0.1, 10)
    expect(costUsd({ input: 0, output: 1_000_000 })).toBeCloseTo(0.5, 10)
    expect(costUsd({ input: 2_000_000, output: 500_000 })).toBeCloseTo(0.2 + 0.25, 10)
    expect(costUsd({ input: 0, output: 0 })).toBe(0)
    expect(costUsd({ input: -5, output: -5 })).toBe(0)
  })
  it("a different price list changes the result without touching the code", () => {
    expect(costUsd({ input: 1_000_000, output: 1_000_000 }, { model: "outro", inputUsdPerMillion: 1, outputUsdPerMillion: 5 })).toBeCloseTo(6, 10)
  })
  it("converts to reais with the constant rate and formats both currencies", () => {
    expect(usdToBrl(2)).toBeCloseTo(2 * USD_TO_BRL, 10)
    expect(usdToBrl(2, 6)).toBe(12)
    expect(formatBrl(1234.5)).toMatch(/R\$\s?1\.234,50/)
    expect(formatUsd(1234.5)).toBe("$1,234.50")
    // the assistant is cheap: fractions of a cent keep their digits instead of showing zero
    expect(formatBrl(0.0023)).toMatch(/0,0023/)
    expect(formatUsd(0.0012)).toBe("$0.0012")
    expect(formatBrl(0)).toMatch(/R\$\s?0,00/)
  })
})

describe("month projection", () => {
  it("counts the days of the month and projects at the pace so far", () => {
    expect(monthDays("2026-11-16")).toEqual({ elapsed: 16, total: 30 })
    expect(monthDays("2028-02-10")).toEqual({ elapsed: 10, total: 29 })
    expect(projectMonth(8, "2026-11-16")).toBeCloseTo((8 / 16) * 30, 10)
    expect(projectMonth(0, "2026-11-01")).toBe(0)
  })
})

describe("budget", () => {
  it("is ok below 80%, a warning from 80% to the budget, exceeded above it, none without a budget", () => {
    expect(budgetState(7.9, 10)).toMatchObject({ state: "ok" })
    expect(budgetState(8, 10)).toMatchObject({ state: "warning" })
    expect(budgetState(10, 10)).toMatchObject({ state: "warning" })
    expect(budgetState(10.01, 10)).toMatchObject({ state: "exceeded" })
    expect(budgetState(5, null)).toEqual({ state: "none", ratio: null })
    expect(budgetState(5, 0)).toEqual({ state: "none", ratio: null })
  })
  it("reads a budget with a comma or a dot, and refuses nonsense", () => {
    expect(parseBudget("20")).toBe(20)
    expect(parseBudget("12,50")).toBe(12.5)
    expect(parseBudget(7.123)).toBe(7.12)
    for (const bad of ["", "abc", "0", "-3", "2000000", null, undefined]) expect(parseBudget(bad as never)).toBeNull()
  })
})

describe("per-account lines", () => {
  const rows = [
    row({ user_id: "a", email: "ana@exemplo.com", name: "Ana Júlia", month: fig(10, 1_000_000, 100_000), total: fig(40, 4_000_000, 400_000), today: fig(2, 100, 50), d7: fig(6, 500_000, 50_000) }),
    row({ user_id: "b", email: "bruno@exemplo.com", name: "Bruno", month: fig(50, 5_000_000, 1_000_000), total: fig(50, 5_000_000, 1_000_000), today: fig(0, 0, 0), d7: fig(50, 5_000_000, 1_000_000) }),
    row({ user_id: "c", email: "carla@exemplo.com", month: fig(1, 1_000, 1_000), total: fig(1, 1_000, 1_000) }),
  ]
  it("sorts by the cost of the chosen period, biggest first", () => {
    expect(costLines(rows, "month", "").map((l) => l.row.user_id)).toEqual(["b", "a", "c"])
    // Ana has the lowest cost today, but is the only one with usage today
    expect(costLines(rows, "today", "").map((l) => l.row.user_id)[0]).toBe("a")
  })
  it("searches name and e-mail without caring for accents or case", () => {
    expect(costLines(rows, "month", "julia").map((l) => l.row.user_id)).toEqual(["a"])
    expect(costLines(rows, "month", "BRUNO@").map((l) => l.row.user_id)).toEqual(["b"])
    expect(costLines(rows, "month", "zzz")).toEqual([])
  })
  it("computes month and total cost per line, a total row and the month spend over everyone", () => {
    const lines = costLines(rows, "month", "")
    const ana = lines.find((l) => l.row.user_id === "a")!
    expect(ana.monthCostUsd).toBeCloseTo(0.1 + 0.05, 10)
    expect(ana.totalCostUsd).toBeCloseTo(0.4 + 0.2, 10)
    const totals = totalsOf(lines)
    expect(totals.shown).toEqual(fig(61, 6_001_000, 1_101_000))
    expect(totals.monthCostUsd).toBeCloseTo(monthSpendUsd(rows), 10)
    // the budget is compared with everyone, even while a search narrows the list
    expect(monthSpendUsd(rows)).toBeCloseTo(0.15 + (0.5 + 0.5) + (0.0001 + 0.0005), 6)
  })
  it("period slugs map to periods, defaulting to the month", () => {
    expect(periodFromSlug("hoje")).toBe("today")
    expect(periodFromSlug("7d")).toBe("d7")
    expect(periodFromSlug("total")).toBe("total")
    expect(periodFromSlug("whatever")).toBe("month")
    expect(periodFromSlug(undefined)).toBe("month")
  })
  it("keeps only well-formed rows from the database answer, with numbers as numbers", () => {
    const parsed = parseCostRows([{ user_id: "x", email: "x@y.z", plan: "pro", month: { messages: "3", input: 10, output: 5 } }, { nope: true }, null])
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({ user_id: "x", plan: "pro", month: { messages: 3, input: 10, output: 5 }, today: fig(0, 0, 0), name: null, last_use: null })
    expect(parseCostRows("lixo")).toEqual([])
  })
})

describe("the admin guard", () => {
  beforeEach(() => {
    state.writes = 0
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test"
  })
  it("a person who is not an admin cannot save a budget: nothing is written", async () => {
    const { saveAssistantBudget } = await import("@/features/admin/assistant-budget-action")
    state.admin = false
    await expect(saveAssistantBudget({ usd: "50" })).rejects.toThrow(/404/)
    expect(state.writes).toBe(0)
  })

  it("an admin saves, clears, and gets a plain message for a bad value", async () => {
    const { saveAssistantBudget } = await import("@/features/admin/assistant-budget-action")
    state.admin = true
    expect(await saveAssistantBudget({ usd: "50" })).toMatchObject({ ok: true })
    expect(await saveAssistantBudget({ usd: "" })).toMatchObject({ ok: true, message: "Orçamento removido." })
    expect(await saveAssistantBudget({ usd: "abc" })).toMatchObject({ ok: false })
    // the audit entry is written together with the budget (insert) each time something was saved or cleared
    expect(state.writes).toBeGreaterThanOrEqual(4)
  })

  it("every way into the numbers goes through the admin check in the code itself, not through the UI", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
    const action = read("src/features/admin/assistant-budget-action.ts")
    expect(action.indexOf("requireAdminForAction()")).toBeGreaterThan(-1)
    expect(action.indexOf("requireAdminForAction()")).toBeLessThan(action.indexOf("createSecretClient()"))
    // the readers are the admin RPCs (the shared helper re-checks the role and each SQL function checks is_admin() itself)
    const data = read("src/lib/admin/data.ts")
    expect(data).toMatch(/assistantCostByUser[\s\S]*rpc<unknown>\("assistant_cost_by_user"\)/)
    expect(data).toMatch(/assistantBudgetSetting = \(\) => rpc<number \| null>\("assistant_budget"\)/)
    expect(data).toMatch(/const admin = cache\(requireAdmin\)/)
    const sql = read("supabase/migrations/20261117000001_admin_assistant_cost.sql")
    for (const fn of ["admin.assistant_cost_by_user", "admin.assistant_budget"]) {
      expect(sql).toMatch(new RegExp(`revoke all on function ${fn.replace(".", "\\.")}\\(\\) from public, anon`))
      expect(sql).toMatch(new RegExp(`grant execute on function ${fn.replace(".", "\\.")}\\(\\) to authenticated`))
    }
    expect(sql).toMatch(/alter table public\.admin_settings enable row level security/)
    expect(sql).toMatch(/revoke all on public\.admin_settings from anon, authenticated/)
  })
})
