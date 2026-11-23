import { describe, expect, it } from "vitest"

import { loadBilling, localBillingRepository, supabaseBillingRepository } from "./repository"

const fakeDb = (subs: unknown, invoices: unknown) => ({
  from: (table: string) => ({ select: () => ({ order: () => ({ limit: async () => (table === "subscriptions" ? subs : invoices) }) }) }),
})

describe("billing repository", () => {
  it("treats missing tables as no billing (Free)", async () => {
    const repo = supabaseBillingRepository(fakeDb({ data: null, error: { code: "42P01" } }, { data: null, error: { code: "42P01" } }))
    expect(await repo.load()).toEqual({ subscription: null, invoices: [] })
  })
  it("maps rows", async () => {
    const repo = supabaseBillingRepository(
      fakeDb({ data: [{ id: "s1", user_id: "u", plan_period: "annual", method: "pix", status: "active", cancel_at_period_end: true, created_at: "2026-11-01T00:00:00Z" }], error: null }, { data: [{ id: "i1", asaas_payment_id: "pay_1", amount_cents: 490, status: "RECEIVED" }], error: null })
    )
    const s = await repo.load()
    expect(s.subscription).toMatchObject({ planPeriod: "annual", method: "pix", status: "active", cancelAtPeriodEnd: true })
    expect(s.invoices[0]).toMatchObject({ amountCents: 490, status: "RECEIVED" })
  })
  it("falls back to the local repository, and absence there is Free too", async () => {
    const empty = { load: async () => ({ subscription: null, invoices: [] }) }
    expect(await loadBilling(empty, localBillingRepository({ getItem: () => null }))).toEqual({ subscription: null, invoices: [] })
    expect(await loadBilling(empty, localBillingRepository({ getItem: () => "{not json" }))).toEqual({ subscription: null, invoices: [] })
  })
})
