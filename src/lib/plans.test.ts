import { describe, expect, it } from "vitest"

import { featureForWrite, planBlockMessage } from "@/features/persist/gate"

import { canUse, canUseAssistant, getEntitlements, GRACE_DAYS, PLANS, PRO_FEATURES, reachedLimit } from "./plans"

const NOW = new Date("2026-11-20T12:00:00Z")
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString()

describe("who is Pro", () => {
  it("nothing known is Free (a missing column, row or table)", () => {
    expect(getEntitlements(null, NOW).plan).toBe("free")
    expect(getEntitlements({}, NOW).plan).toBe("free")
    expect(getEntitlements({ plan: "weird" }, NOW).pro).toBe(false)
  })
  it("existing Pro profiles with no end date keep working untouched", () => {
    expect(getEntitlements({ plan: "pro", planUntil: null }, NOW).pro).toBe(true)
    expect(getEntitlements({ plan: "pro" }, NOW).pro).toBe(true)
  })
  it("Pro until plan_until, Free the moment it passes", () => {
    expect(getEntitlements({ plan: "pro", planUntil: day(5) }, NOW).pro).toBe(true)
    expect(getEntitlements({ plan: "pro", planUntil: day(-1) }, NOW).pro).toBe(false)
  })
  it("a failed renewal keeps Pro through the grace period, flagged, then ends", () => {
    expect(GRACE_DAYS).toBe(3)
    const inGrace = getEntitlements({ plan: "pro", planUntil: day(-1), graceUntil: day(2) }, NOW)
    expect(inGrace).toMatchObject({ pro: true, inGrace: true, plan: "pro" })
    expect(getEntitlements({ plan: "pro", planUntil: day(-5), graceUntil: day(-1) }, NOW).pro).toBe(false)
  })
  it("a grace date alone never makes a Free person Pro", () => {
    expect(getEntitlements({ plan: "free", graceUntil: day(2) }, NOW).pro).toBe(false)
  })
  it("admins are always Pro", () => {
    expect(getEntitlements({ isAdmin: true }, NOW)).toMatchObject({ pro: true, plan: "pro", inGrace: false })
    expect(getEntitlements({ plan: "pro", planUntil: day(-9), isAdmin: true }, NOW).pro).toBe(true)
  })
})

describe("limits and features", () => {
  it("Free: 1 board, 3 lists, no assistant, no Pro features; Pro: unlimited and 200 messages", () => {
    const free = getEntitlements({}, NOW)
    expect([free.limit("boards"), free.limit("lists"), free.limit("assistantMessagesPerDay")]).toEqual([1, 3, 0])
    for (const feature of PRO_FEATURES) expect(free.canUse(feature)).toBe(false)
    const pro = getEntitlements({ plan: "pro" }, NOW)
    expect([pro.limit("boards"), pro.limit("lists"), pro.limit("assistantMessagesPerDay")]).toEqual([null, null, 200])
    for (const feature of PRO_FEATURES) expect(pro.canUse(feature)).toBe(true)
  })
  it("only creating is blocked at the limit: reaching it, never data removal", () => {
    expect(reachedLimit("free", "lists", 2)).toBe(false)
    expect(reachedLimit("free", "lists", 3)).toBe(true)
    expect(reachedLimit("free", "lists", 5)).toBe(true) // already has 5: no new ones
    expect(reachedLimit("pro", "lists", 500)).toBe(false)
  })
  it("the assistant is Pro only, and the prices are the launch ones", () => {
    expect(canUseAssistant("free")).toBe(false)
    expect(canUse("pro", "assistant")).toBe(true)
    expect(PLANS.pro.price).toEqual({ monthlyCents: 2490, yearlyCents: 25000, firstMonthCents: 500 })
    // 12 x 24,90 = 298,80 ; the annual saves 48,80
    expect(PLANS.pro.price.monthlyCents * 12 - PLANS.pro.price.yearlyCents).toBe(4880)
  })
})

describe("what the server refuses a Free account (persistRows gate)", () => {
  it("Pro modules, fixed bills, goals and budgets are locked; plain finance entries are not", () => {
    expect(featureForWrite("habits", [{}])).toBe("moduleRotina")
    expect(featureForWrite("events", [{}])).toBe("moduleAgenda")
    expect(featureForWrite("workout_plans", [{}])).toBe("moduleTreinos")
    expect(featureForWrite("weight_logs", [{}])).toBe("moduleDieta")
    expect(featureForWrite("notes", [{}])).toBe("moduleNotas")
    expect(featureForWrite("life_goals", [{}])).toBe("moduleMetas")
    expect(featureForWrite("journal_entries", [{}])).toBe("moduleDiario")
    expect(featureForWrite("finance_bills", [{}])).toBe("financeRecurring")
    expect(featureForWrite("finance_goals", [{}])).toBe("financeGoals")
    expect(featureForWrite("finance_transactions", [{}])).toBeNull()
    expect(featureForWrite("finance_accounts", [{}])).toBeNull()
    expect(featureForWrite("finance_categories", [{ name: "Mercado", monthly_limit_cents: null }])).toBeNull()
    expect(featureForWrite("finance_categories", [{ name: "Mercado", monthly_limit_cents: 50000 }])).toBe("financeBudget")
  })
  it("the refusal says the data is kept", () => {
    expect(planBlockMessage("moduleTreinos")).toBe("Treinos faz parte do Pro. O que você já salvou continua guardado e volta quando o Pro voltar.")
    expect(planBlockMessage("financeRecurring")).toMatch(/^Contas fixas e parceladas faz parte do Pro/)
  })
})
