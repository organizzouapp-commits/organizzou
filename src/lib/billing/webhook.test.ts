import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const secret = vi.hoisted(() => ({ writes: 0 }))
vi.mock("@/lib/admin/secret", () => ({
  secretKeyConfigured: () => true,
  createSecretClient: () => {
    const chain: Record<string, unknown> = { insert: async () => (secret.writes++, { error: null }), update: () => ({ eq: async () => ({ error: null }) }), select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    return { from: () => chain }
  },
}))

import type { AsaasClient } from "./asaas"
import { memoryBillingStore } from "./memory-store"
import { handleWebhook, syncPayment, tokenMatches, type WebhookPayload } from "./webhook"

const NOW = new Date("2026-11-20T15:00:00Z")

/** Sample payloads in the shape Asaas documents (id evt_..., event, payment{...} or subscription{...}). */
const payment = (event: string, over: Record<string, unknown> = {}, id = "evt_1"): WebhookPayload => ({
  id,
  event,
  payment: { id: "pay_1", status: "RECEIVED", value: 4.9, dueDate: "2026-11-20", billingType: "PIX", subscription: "sub_1", invoiceUrl: "https://asaas.test/i/pay_1", paymentDate: "2026-11-20", ...over },
})

async function world(period: "monthly" | "annual" = "monthly", status: "pending" | "active" = "pending") {
  const m = memoryBillingStore()
  const sub = await m.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_1", planPeriod: period, method: "pix", status })
  await m.store.upsertInvoice({ userId: "u1", asaasSubscriptionId: "sub_1", asaasPaymentId: "pay_1", amountCents: 490, status: "PENDING", method: "pix", dueDate: "2026-11-20", paidAt: null, invoiceUrl: null, description: null })
  return { ...m, sub }
}

describe("the token", () => {
  it("matches only the exact value, and never when either side is missing", () => {
    expect(tokenMatches("s3cret", "s3cret")).toBe(true)
    expect(tokenMatches("s3cret!", "s3cret")).toBe(false)
    expect(tokenMatches("", "s3cret")).toBe(false)
    expect(tokenMatches(null, "s3cret")).toBe(false)
    expect(tokenMatches("s3cret", undefined)).toBe(false)
    expect(tokenMatches("x", "")).toBe(false)
  })
})

describe("payment confirmed or received", () => {
  it("activates Pro until the end of the monthly period, marks the invoice paid and the subscription active", async () => {
    const w = await world()
    expect(await handleWebhook(w.store, payment("PAYMENT_RECEIVED"), NOW)).toEqual({ handled: "ok" })
    expect(w.profiles.get("u1")).toEqual({ plan: "pro", planUntil: "2026-12-20T23:59:59-03:00" })
    expect(w.invoices[0]).toMatchObject({ status: "RECEIVED", amountCents: 490, paidAt: "2026-11-20T12:00:00Z" })
    expect(w.subscriptions[0]).toMatchObject({ status: "active", currentPeriodEnd: "2026-12-20", graceUntil: null })
  })
  it("CONFIRMED (card) activates the same way", async () => {
    const w = await world()
    await handleWebhook(w.store, payment("PAYMENT_CONFIRMED", { status: "CONFIRMED", billingType: "CREDIT_CARD" }), NOW)
    expect(w.profiles.get("u1")?.plan).toBe("pro")
    expect(w.invoices[0].status).toBe("CONFIRMED")
  })
  it("annual pays a year", async () => {
    const w = await world("annual")
    await handleWebhook(w.store, payment("PAYMENT_RECEIVED", { value: 250 }), NOW)
    expect(w.profiles.get("u1")?.planUntil).toBe("2027-11-20T23:59:59-03:00")
    expect(w.invoices[0].amountCents).toBe(25000)
  })
  it("a renewal extends Pro and clears the grace period; an earlier end is never shortened", async () => {
    const w = await world("monthly", "active")
    await w.store.patchSubscription(w.sub.id, { status: "overdue", graceUntil: "2026-11-23T00:00:00Z" })
    await handleWebhook(w.store, payment("PAYMENT_RECEIVED", { id: "pay_2", value: 24.9, dueDate: "2026-12-20", paymentDate: "2026-12-21" }, "evt_2"), NOW)
    // pay_2 is not a known invoice yet, but its subscription is: it is created and applied
    expect(w.profiles.get("u1")?.planUntil).toBe("2027-01-20T23:59:59-03:00")
    expect(w.subscriptions[0]).toMatchObject({ status: "active", graceUntil: null })
    // a late event for an older charge does not move the end backwards
    await handleWebhook(w.store, payment("PAYMENT_RECEIVED", {}, "evt_3"), NOW)
    expect(w.profiles.get("u1")?.planUntil).toBe("2027-01-20T23:59:59-03:00")
  })
})

describe("idempotency", () => {
  it("the same event id twice changes nothing the second time", async () => {
    const w = await world()
    expect(await handleWebhook(w.store, payment("PAYMENT_RECEIVED"), NOW)).toEqual({ handled: "ok" })
    await w.store.setProfilePlan("u1", { plan: "free", planUntil: null })
    expect(await handleWebhook(w.store, payment("PAYMENT_RECEIVED"), NOW)).toEqual({ handled: "duplicate" })
    expect(w.profiles.get("u1")).toEqual({ plan: "free", planUntil: null })
  })
  it("an event whose processing failed is processed again when Asaas retries it", async () => {
    const w = await world()
    const original = w.store.setProfilePlan
    let broken = true
    w.store.setProfilePlan = async (...args) => {
      if (broken) throw new Error("db down")
      return original(...args)
    }
    await expect(handleWebhook(w.store, payment("PAYMENT_RECEIVED"), NOW)).rejects.toThrow()
    broken = false
    expect(await handleWebhook(w.store, payment("PAYMENT_RECEIVED"), NOW)).toEqual({ handled: "ok" })
    expect(w.profiles.get("u1")?.plan).toBe("pro")
  })
  it("garbage and unknown events are recorded or ignored, never an error", async () => {
    const w = await world()
    expect(await handleWebhook(w.store, {} as WebhookPayload, NOW)).toEqual({ handled: "invalid" })
    expect(await handleWebhook(w.store, { id: "evt_x", event: "PAYMENT_BANK_SLIP_VIEWED", payment: { id: "pay_1", subscription: "sub_1" } }, NOW)).toEqual({ handled: "ignored" })
    expect(await handleWebhook(w.store, payment("PAYMENT_RECEIVED", { id: "pay_other", subscription: "sub_unknown" }, "evt_y"), NOW)).toEqual({ handled: "ignored" })
    expect(w.profiles.size).toBe(0)
  })
  it("keeps only the minimal payload in billing_events (no personal data)", async () => {
    const w = await world()
    const spy = vi.spyOn(w.store, "recordEvent")
    await handleWebhook(w.store, { ...payment("PAYMENT_RECEIVED"), payment: { ...payment("x").payment, customer: "cus_1", description: "Ana 529.982.247-25" } as never }, NOW)
    const stored = spy.mock.calls[0][0].payload as { payment: Record<string, unknown> }
    expect(Object.keys(stored.payment).sort()).toEqual(["billingType", "dueDate", "id", "status", "subscription", "value"])
  })
})

describe("overdue, refund and subscription end", () => {
  it("a failed renewal opens a 3-day grace period and keeps the plan end", async () => {
    const w = await world("monthly", "active")
    await w.store.setProfilePlan("u1", { plan: "pro", planUntil: "2026-11-20T23:59:59-03:00" })
    await handleWebhook(w.store, payment("PAYMENT_OVERDUE", { status: "OVERDUE", id: "pay_1" }), NOW)
    expect(w.invoices[0].status).toBe("OVERDUE")
    expect(w.subscriptions[0]).toMatchObject({ status: "overdue", graceUntil: "2026-11-23T15:00:00.000Z" })
    expect(w.profiles.get("u1")?.planUntil).toBe("2026-11-20T23:59:59-03:00")
  })
  it("an unpaid FIRST payment that goes overdue just stays pending (no grace, never Pro)", async () => {
    const w = await world()
    await handleWebhook(w.store, payment("PAYMENT_OVERDUE", { status: "OVERDUE" }), NOW)
    expect(w.subscriptions[0]).toMatchObject({ status: "pending", graceUntil: null })
    expect(w.profiles.size).toBe(0)
  })
  it("a refund ends Pro now and keeps the data (only the plan flips)", async () => {
    const w = await world("monthly", "active")
    await w.store.setProfilePlan("u1", { plan: "pro", planUntil: "2026-12-20T23:59:59-03:00" })
    await handleWebhook(w.store, payment("PAYMENT_REFUNDED", { status: "REFUNDED" }), NOW)
    expect(w.profiles.get("u1")).toEqual({ plan: "free", planUntil: null })
    expect(w.invoices[0].status).toBe("REFUNDED")
    expect(w.subscriptions[0].status).toBe("ended")
  })
  it("SUBSCRIPTION_DELETED ends the recurrence but Pro runs until plan_until", async () => {
    const w = await world("monthly", "active")
    await w.store.setProfilePlan("u1", { plan: "pro", planUntil: "2026-12-20T23:59:59-03:00" })
    await handleWebhook(w.store, { id: "evt_s", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } }, NOW)
    expect(w.subscriptions[0]).toMatchObject({ cancelAtPeriodEnd: true, status: "active" })
    expect(w.profiles.get("u1")).toEqual({ plan: "pro", planUntil: "2026-12-20T23:59:59-03:00" })
  })
  it("SUBSCRIPTION_INACTIVATED on a never-paid subscription cancels it", async () => {
    const w = await world()
    await handleWebhook(w.store, { id: "evt_i", event: "SUBSCRIPTION_INACTIVATED", subscription: { id: "sub_1" } }, NOW)
    expect(w.subscriptions[0].status).toBe("canceled")
  })
  it("a new charge appears in the invoice list, and a paid one is never taken back to pending", async () => {
    const w = await world("monthly", "active")
    await handleWebhook(w.store, payment("PAYMENT_CREATED", { id: "pay_9", status: "PENDING", value: 24.9, dueDate: "2026-12-20" }, "evt_c"), NOW)
    expect(w.invoices.find((i) => i.asaasPaymentId === "pay_9")).toMatchObject({ status: "PENDING", amountCents: 2490 })
    await handleWebhook(w.store, payment("PAYMENT_RECEIVED", {}, "evt_p"), NOW)
    await handleWebhook(w.store, payment("PAYMENT_UPDATED", { status: "PENDING" }, "evt_u"), NOW)
    expect(w.invoices.find((i) => i.asaasPaymentId === "pay_1")?.status).toBe("RECEIVED")
  })
})

describe("syncPayment (the Pix dialog asks while the webhook is late)", () => {
  const asaas = (status: string) => ({ getPayment: vi.fn(async () => ({ id: "pay_1", status, value: 4.9, dueDate: "2026-11-20", billingType: "PIX", subscription: "sub_1" })) }) as unknown as Pick<AsaasClient, "getPayment">
  it("applies a paid payment once, with the same handler", async () => {
    const w = await world()
    const client = asaas("RECEIVED")
    expect(await syncPayment({ asaas: client, store: w.store, now: NOW }, "u1", "pay_1")).toBe(true)
    expect(w.profiles.get("u1")?.plan).toBe("pro")
    // the real webhook arriving later is not a second activation: the invoice is already paid
    expect(await handleWebhook(w.store, payment("PAYMENT_RECEIVED", {}, "evt_late"), NOW)).toEqual({ handled: "ok" })
    expect(w.profiles.get("u1")?.planUntil).toBe("2026-12-20T23:59:59-03:00")
  })
  it("a pending payment says not yet, and someone else's payment is never looked at", async () => {
    const w = await world()
    expect(await syncPayment({ asaas: asaas("PENDING"), store: w.store, now: NOW }, "u1", "pay_1")).toBe(false)
    const other = asaas("RECEIVED")
    expect(await syncPayment({ asaas: other, store: w.store, now: NOW }, "u2", "pay_1")).toBe(false)
    expect(other.getPayment).not.toHaveBeenCalled()
  })
})

describe("the route and the proxy", () => {
  beforeEach(() => {
    process.env.ASAAS_WEBHOOK_TOKEN = "hook-token"
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test"
    secret.writes = 0
  })
  const call = async (token: string | null, body: unknown) => {
    const { POST } = await import("@/app/api/webhooks/asaas/route")
    return POST(new Request("https://organizzou.com/api/webhooks/asaas", { method: "POST", headers: token === null ? {} : { "asaas-access-token": token }, body: JSON.stringify(body) }))
  }
  it("401 without the token or with a wrong one, and nothing is written", async () => {
    expect((await call(null, payment("PAYMENT_RECEIVED"))).status).toBe(401)
    expect((await call("wrong", payment("PAYMENT_RECEIVED"))).status).toBe(401)
    expect(secret.writes).toBe(0)
  })
  it("503 when the token is not configured: nothing is accepted without authentication", async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN
    expect((await call("anything", payment("PAYMENT_RECEIVED"))).status).toBe(503)
  })
  it("200 with the right token, and the body of the answer says nothing about the inside", async () => {
    const response = await call("hook-token", payment("PAYMENT_RECEIVED"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(secret.writes).toBe(1)
  })
  it("a broken body is acknowledged, not retried forever", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route")
    const response = await POST(new Request("https://organizzou.com/api/webhooks/asaas", { method: "POST", headers: { "asaas-access-token": "hook-token" }, body: "{nope" }))
    expect(response.status).toBe(200)
  })
  it("the proxy leaves /api/webhooks/ out of the session checks, and the security headers are untouched", () => {
    const proxy = readFileSync(join(process.cwd(), "src/lib/supabase/proxy.ts"), "utf8")
    expect(proxy).toContain('!pathname.startsWith("/api/webhooks/")')
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8")
    expect(config).toContain("microphone=(self)")
    expect(config).toContain("camera=()")
  })
})
