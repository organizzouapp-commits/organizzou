import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { AsaasError, type AsaasClient, type AsaasPayment, type AsaasSubscription } from "./asaas"
import { memoryBillingStore } from "./memory-store"
import { cancelSubscription, changePlan, deleteSubscriptionReliably, getStatus, isLaunchEligible, ORPHAN_MESSAGE, startCheckout, subscriptionAtAsaas, UNREACHABLE_MESSAGE, type BillingUser, type Deps } from "./service"

const USER: BillingUser = { id: "u1", email: "ana@exemplo.com", name: "Ana" }
const NOW = new Date("2026-11-20T15:00:00Z")
const CPF = "529.982.247-25"

/** A fake Asaas that behaves as documented: a subscription generates its first charge at once. */
function fakeAsaas(over: Partial<Record<keyof AsaasClient, unknown>> = {}) {
  const calls: { op: string; args: unknown[] }[] = []
  const log = <T>(op: string, value: T) => async (...args: unknown[]) => (calls.push({ op, args }), value)
  const first: AsaasPayment = { id: "pay_1", status: "PENDING", value: 24.9, dueDate: "2026-11-20", invoiceUrl: "https://asaas.test/i/pay_1", bankSlipUrl: "https://asaas.test/b/pay_1", billingType: "CREDIT_CARD" }
  const client = {
    createCustomer: log("createCustomer", { id: "cus_1" }),
    getSubscription: log("getSubscription", { id: "sub_old", status: "ACTIVE", value: 24.9, nextDueDate: "2026-12-20", cycle: "MONTHLY", billingType: "PIX", customer: "cus_1" }),
    createSubscription: log("createSubscription", { id: "sub_1", status: "ACTIVE", value: 24.9, nextDueDate: "2026-11-20", cycle: "MONTHLY", billingType: "CREDIT_CARD", customer: "cus_1" }),
    updateSubscription: log("updateSubscription", {}),
    deleteSubscription: log("deleteSubscription", { deleted: true, id: "sub_1" }),
    listSubscriptionPayments: log("listSubscriptionPayments", { data: [first] }),
    updatePayment: async (...args: unknown[]) => (calls.push({ op: "updatePayment", args }), { ...first, value: (args[1] as { value: number }).value }),
    createPayment: log("createPayment", first),
    getPayment: log("getPayment", first),
    getPixQrCode: log("getPixQrCode", { encodedImage: "BASE64", payload: "000201...", expirationDate: "2026-11-21 23:59:59" }),
    ...over,
  } as unknown as AsaasClient
  return { client, calls }
}

function setup(over: Partial<Record<keyof AsaasClient, unknown>> = {}) {
  const asaas = fakeAsaas(over)
  const mem = memoryBillingStore()
  const deps: Deps = { asaas: asaas.client, store: mem.store, now: NOW, today: "2026-11-20", siteUrl: "https://organizzou.com", returnPath: "/dashboard/configuracoes?aba=plano&pagamento=retorno" }
  return { ...asaas, ...mem, deps }
}

describe("checkout", () => {
  it("monthly with card: the subscription is R$ 24,90, the FIRST charge is edited to R$ 5,00, and the person is sent to the hosted page", async () => {
    const t = setup()
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, kind: "redirect", url: "https://asaas.test/i/pay_1", amountCents: 500 })
    const sub = t.calls.find((c) => c.op === "createSubscription")!.args[0] as Record<string, unknown>
    expect(sub).toMatchObject({ customer: "cus_1", billingType: "CREDIT_CARD", value: 24.9, cycle: "MONTHLY", nextDueDate: "2026-11-20", externalReference: "u1" })
    // no callback and no empty field: Asaas answers invalid_object to a body it cannot read
    expect(sub).not.toHaveProperty("callback")
    expect(t.calls.find((c) => c.op === "updatePayment")!.args).toEqual(["pay_1", expect.objectContaining({ value: 5, dueDate: "2026-11-20", billingType: "CREDIT_CARD" })])
    // stored as pending, with the first invoice at R$ 5,00 and the CPF kept only in our store
    expect(t.subscriptions[0]).toMatchObject({ status: "pending", planPeriod: "monthly", method: "card" })
    expect(t.invoices[0]).toMatchObject({ amountCents: 500, asaasPaymentId: "pay_1" })
    expect(t.customers.get("u1")).toEqual({ asaasCustomerId: "cus_1", cpfCnpj: "52998224725" })
  })
  it("Pix answers with the QR code and the copy-and-paste text, and boleto with the slip page", async () => {
    const pix = setup()
    expect(await startCheckout(pix.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: true, kind: "pix", qrImage: "BASE64", payload: "000201...", expiresAt: "2026-11-21 23:59:59", amountCents: 500 })
    const slip = setup()
    expect(await startCheckout(slip.deps, USER, { period: "monthly", method: "boleto", cpfCnpj: CPF })).toMatchObject({ ok: true, kind: "redirect", url: "https://asaas.test/b/pay_1" })
  })
  it("annual is R$ 250,00 flat: no first-charge edit", async () => {
    const t = setup()
    const result = await startCheckout(t.deps, USER, { period: "annual", method: "card", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, amountCents: 25000 })
    expect(t.calls.find((c) => c.op === "createSubscription")!.args[0]).toMatchObject({ value: 250, cycle: "YEARLY" })
    expect(t.calls.some((c) => c.op === "updatePayment")).toBe(false)
  })
  it("someone who already paid once gets no launch price", async () => {
    const t = setup()
    await t.store.upsertInvoice({ userId: "u1", asaasSubscriptionId: null, asaasPaymentId: "old", amountCents: 500, status: "RECEIVED", method: "card", dueDate: "2026-01-01", paidAt: "2026-01-01T00:00:00Z", invoiceUrl: null, description: null })
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, amountCents: 2490 })
    expect(t.calls.some((c) => c.op === "updatePayment")).toBe(false)
  })
  it("if the R$ 5,00 edit fails the subscription is deleted and nothing is charged", async () => {
    const t = setup({ updatePayment: async () => Promise.reject(new AsaasError("x", 400)) })
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Nada foi cobrado") })
    expect(t.calls.some((c) => c.op === "deleteSubscription")).toBe(true)
    expect(t.subscriptions).toHaveLength(0)
  })
  it("an invalid CPF never reaches Asaas", async () => {
    const t = setup()
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: "111.111.111-11" })).toMatchObject({ ok: false, error: expect.stringContaining("CPF ou CNPJ inválido") })
    expect(t.calls).toHaveLength(0)
  })
  it("an active subscription cannot be started twice; an abandoned pending one is replaced", async () => {
    const t = setup()
    const sub = await t.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_old", planPeriod: "monthly", method: "card", status: "active" })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })).toMatchObject({ ok: false, status: 409 })
    await t.store.patchSubscription(sub.id, { status: "pending" })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })).toMatchObject({ ok: true })
    expect(t.calls.find((c) => c.op === "deleteSubscription")!.args[0]).toBe("sub_old")
    expect(t.subscriptions[0].status).toBe("canceled")
  })
  it("an Asaas error becomes its friendly message", async () => {
    const t = setup({ createCustomer: async () => Promise.reject(new AsaasError("CPF ou CNPJ inválido. Confira os números e tente de novo.", 400)) })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })).toMatchObject({ ok: false, status: 400, error: "CPF ou CNPJ inválido. Confira os números e tente de novo." })
  })
})

describe("status, cancel and change", () => {
  async function active() {
    const t = setup()
    const sub = await t.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_1", planPeriod: "monthly", method: "card", status: "active" })
    await t.store.patchSubscription(sub.id, { currentPeriodEnd: "2026-12-20" })
    await t.store.setProfilePlan("u1", { plan: "pro", planUntil: "2026-12-20T23:59:59Z" })
    return t
  }
  it("no billing at all reads as Free", async () => {
    const t = setup()
    expect(await getStatus(t.deps, "u1")).toMatchObject({ plan: "free", subscription: null, pendingPayment: false, chargeFailed: false })
  })
  it("an active Pro shows the next charge and the saving of the annual plan", async () => {
    const t = await active()
    expect(await getStatus(t.deps, "u1")).toMatchObject({ plan: "pro", subscription: { period: "monthly", method: "card", nextChargeCents: 2490, nextChargeOn: "2026-12-20", cancelAtPeriodEnd: false }, annualSavingCents: 4880 })
  })
  it("a pending checkout shows as pending payment", async () => {
    const t = setup()
    await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(await getStatus(t.deps, "u1")).toMatchObject({ plan: "free", pendingPayment: true })
  })
  it("cancel keeps Pro until the end of the period and removes the recurrence", async () => {
    const t = await active()
    expect(await cancelSubscription(t.deps, "u1")).toEqual({ ok: true, endsOn: "2026-12-20T23:59:59Z" })
    expect(t.calls.find((c) => c.op === "deleteSubscription")!.args[0]).toBe("sub_1")
    expect(t.subscriptions[0]).toMatchObject({ cancelAtPeriodEnd: true, status: "active" })
    expect(t.profiles.get("u1")).toEqual({ plan: "pro", planUntil: "2026-12-20T23:59:59Z" })
    expect(await getStatus(t.deps, "u1")).toMatchObject({ plan: "pro", subscription: { cancelAtPeriodEnd: true, nextChargeOn: null } })
  })
  it("canceling with nothing to cancel is a clear 404", async () => {
    expect(await cancelSubscription(setup().deps, "u1")).toMatchObject({ ok: false, status: 404 })
  })
  it("change plan: monthly to annual from the next charge, same plan refused", async () => {
    const t = await active()
    expect(await changePlan(t.deps, "u1", "monthly")).toMatchObject({ ok: false, status: 409 })
    expect(await changePlan(t.deps, "u1", "annual")).toEqual({ ok: true, period: "annual", effectiveOn: "2026-12-20" })
    expect(t.calls.find((c) => c.op === "updateSubscription")!.args).toEqual(["sub_1", expect.objectContaining({ value: 250, cycle: "YEARLY", nextDueDate: "2026-12-20", updatePendingPayments: false })])
    expect(t.subscriptions[0].planPeriod).toBe("annual")
  })
  it("change plan needs an active, not canceled, subscription", async () => {
    expect(await changePlan(setup().deps, "u1", "annual")).toMatchObject({ ok: false, status: 409 })
    const t = await active()
    await cancelSubscription(t.deps, "u1")
    expect(await changePlan(t.deps, "u1", "annual")).toMatchObject({ ok: false, status: 409 })
  })
})

describe("a failure after the subscription exists leaves nothing behind", () => {
  it("the first-month edit only runs after the subscription was created, and not at all if creating it failed", async () => {
    const ok = setup()
    await startCheckout(ok.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    const ops = ok.calls.map((c) => c.op)
    expect(ops.indexOf("createSubscription")).toBeGreaterThan(-1)
    expect(ops.indexOf("updatePayment")).toBeGreaterThan(ops.indexOf("listSubscriptionPayments"))
    expect(ops.indexOf("listSubscriptionPayments")).toBeGreaterThan(ops.indexOf("createSubscription"))

    const bad = setup({ createSubscription: async () => Promise.reject(new AsaasError("x", 400, ["invalid_object"])) })
    const result = await startCheckout(bad.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(bad.calls.some((c) => c.op === "updatePayment" || c.op === "listSubscriptionPayments" || c.op === "deleteSubscription")).toBe(false)
    expect(bad.subscriptions).toHaveLength(0)
    expect(bad.invoices).toHaveLength(0)
  })
  it("if listing the first charge throws, the subscription is deleted (no orphan that would bill R$ 24,90 later)", async () => {
    const t = setup({ listSubscriptionPayments: async () => Promise.reject(new AsaasError("x", 502)) })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })).toMatchObject({ ok: false })
    expect(t.calls.find((c) => c.op === "deleteSubscription")!.args[0]).toBe("sub_1")
  })
  it("if the Pix QR code cannot be read, the subscription is deleted and the stored row is canceled", async () => {
    const t = setup({ getPixQrCode: async () => Promise.reject(new AsaasError("x", 500)) })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: false })
    expect(t.calls.some((c) => c.op === "deleteSubscription")).toBe(true)
    expect(t.subscriptions[0].status).toBe("canceled")
  })
  it("only a customer can remain after a failure, never a charge, and it is reused on the next try", async () => {
    const t = setup({ createSubscription: async () => Promise.reject(new AsaasError("x", 400, ["invalid_object"])) })
    await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(t.customers.get("u1")).toBeDefined()
    expect(t.calls.filter((c) => c.op === "createCustomer")).toHaveLength(1)
  })
  it("the first charge is due today in Sao Paulo", async () => {
    const t = setup()
    t.deps.now = new Date("2026-11-24T01:00:00Z") // 23/11 22:00 in Sao Paulo
    t.deps.today = "2026-11-23"
    await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect((t.calls.find((c) => c.op === "createSubscription")!.args[0] as { nextDueDate: string }).nextDueDate).toBe("2026-11-23")
  })
})

describe("the minimum charge guard in the checkout", () => {
  it("a value below R$ 5,00 never reaches Asaas: not even the customer is created", async () => {
    const { PLANS } = await import("@/lib/plans")
    const original = PLANS.pro.price.firstMonthCents
    PLANS.pro.price.firstMonthCents = 490
    const log = vi.fn()
    console.error = log
    try {
      const t = setup()
      const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
      expect(result).toMatchObject({ ok: false, status: 500, error: expect.stringContaining("Nada foi cobrado") })
      expect(t.calls).toHaveLength(0)
      expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({ event: "billing_below_minimum", op: "checkout", cents: 490 })
    } finally {
      PLANS.pro.price.firstMonthCents = original
    }
  })
  it("with the launch price at exactly R$ 5,00 the first charge is edited to 5 and the body has no discount field", async () => {
    const t = setup()
    await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    const [, body] = t.calls.find((c) => c.op === "updatePayment")!.args as [string, Record<string, unknown>]
    expect(body).toEqual({ billingType: "PIX", value: 5, dueDate: "2026-11-20", description: "Organizzou Pro - plano mensal (1o mes)" })
    expect(body).not.toHaveProperty("discount")
  })
})

describe("cleanup after a failed checkout", () => {
  const failLaunchEdit = { updatePayment: async () => Promise.reject(new AsaasError("x", 400, ["invalid_object"])) }
  const http500 = () => new AsaasError("Erro", 500, ["unknown.error"])

  it("a delete that fails with 500 twice and then works is retried with a short backoff, and the person is told nothing was charged", async () => {
    let attempts = 0
    const t = setup({ ...failLaunchEdit, deleteSubscription: async () => (++attempts < 3 ? Promise.reject(http500()) : { deleted: true, id: "sub_1" }) })
    const sleep = vi.fn(async (_ms: number) => undefined)
    t.deps.sleep = sleep
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: false, error: "Não consegui aplicar o preço de lançamento. Nada foi cobrado. Tente de novo." })
    expect(attempts).toBe(3)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([300, 1200])
    expect(t.orphans).toHaveLength(0)
  })
  it("a subscription that is already gone (404) counts as cleaned", async () => {
    const t = setup({ ...failLaunchEdit, deleteSubscription: async () => Promise.reject(new AsaasError("x", 404)) })
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Nada foi cobrado") })
    expect(t.orphans).toHaveLength(0)
  })
  it("when every attempt fails the orphan is recorded and logged (operation, status, Asaas id only) and the person is sent to support", async () => {
    const log = vi.fn()
    console.error = log
    const t = setup({ ...failLaunchEdit, deleteSubscription: async () => Promise.reject(http500()) })
    t.deps.sleep = async () => undefined
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: false, status: 502, error: ORPHAN_MESSAGE })
    expect(result.ok === false && result.error).not.toContain("Nada foi cobrado")
    expect(t.orphans).toEqual([expect.objectContaining({ asaasSubscriptionId: "sub_1", userId: "u1", open: true })])
    const logged = JSON.parse(String(log.mock.calls.at(-1)![0]))
    expect(logged).toEqual({ event: "asaas_orphan", op: "deleteSubscription", status: 500, subscription: "sub_1" })
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/ana@exemplo|529\.982|52998224725/)
    // it failed before a row was stored: the orphan record is the only trace, and no invoice was created
    expect(t.subscriptions).toHaveLength(0)
    expect(t.invoices).toHaveLength(0)
  })
  it("a failure after the subscription exists (the QR code) also records the orphan when the delete keeps failing", async () => {
    console.error = vi.fn()
    const t = setup({ getPixQrCode: async () => Promise.reject(new AsaasError("x", 500)), deleteSubscription: async () => Promise.reject(http500()) })
    t.deps.sleep = async () => undefined
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: false, error: ORPHAN_MESSAGE })
    expect(t.orphans).toHaveLength(1)
    // here a row was stored, and it stays pending (not canceled) while the cleanup is outstanding
    expect(t.subscriptions[0].status).toBe("pending")
  })
  it("a retry first cleans the open orphan, then creates exactly one new subscription", async () => {
    const t = setup()
    await t.store.recordOrphan("sub_old", "u1")
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, kind: "pix" })
    const ops = t.calls.map((c) => [c.op, c.args[0]])
    expect(ops.findIndex((o) => o[0] === "deleteSubscription" && o[1] === "sub_old")).toBeLessThan(ops.findIndex((o) => o[0] === "createSubscription"))
    expect(t.calls.filter((c) => c.op === "createSubscription")).toHaveLength(1)
    expect(t.orphans.find((o) => o.asaasSubscriptionId === "sub_old")?.open).toBe(false)
  })
  it("if the open orphan still cannot be deleted, no duplicate subscription is created", async () => {
    const t = setup({ deleteSubscription: async () => Promise.reject(http500()) })
    t.deps.sleep = async () => undefined
    await t.store.recordOrphan("sub_old", "u1")
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: false, status: 409, error: ORPHAN_MESSAGE })
    expect(t.calls.some((c) => c.op === "createSubscription" || c.op === "createCustomer")).toBe(false)
  })
  it("an abandoned pending checkout is removed before the new one, and kept (with an orphan record) if it cannot be removed", async () => {
    const ok = setup()
    await ok.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_pending", planPeriod: "monthly", method: "pix", status: "pending" })
    expect(await startCheckout(ok.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: true })
    expect(ok.calls.find((c) => c.op === "deleteSubscription")!.args[0]).toBe("sub_pending")

    console.error = vi.fn()
    const bad = setup({ deleteSubscription: async () => Promise.reject(http500()) })
    bad.deps.sleep = async () => undefined
    await bad.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_pending", planPeriod: "monthly", method: "pix", status: "pending" })
    expect(await startCheckout(bad.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: false, status: 409 })
    expect(bad.orphans.map((o) => o.asaasSubscriptionId)).toEqual(["sub_pending"])
    expect(bad.calls.some((c) => c.op === "createSubscription")).toBe(false)
  })
  it("the helper itself: retries, not found, and the final status", async () => {
    const sleeps: number[] = []
    const sleep = async (ms: number) => void sleeps.push(ms)
    expect(await deleteSubscriptionReliably({ deleteSubscription: async () => Promise.reject(http500()) } as never, "sub_x", sleep)).toEqual({ ok: false, status: 500 })
    expect(sleeps).toEqual([300, 1200])
    expect(await deleteSubscriptionReliably({ deleteSubscription: async () => Promise.reject(new AsaasError("x", 0)) } as never, "sub_x", sleep)).toEqual({ ok: false, status: 0 })
    expect(await deleteSubscriptionReliably({ deleteSubscription: async () => ({ deleted: true, id: "sub_x" }) } as never, "sub_x", sleep)).toEqual({ ok: true })
  })
})

describe("the 'already active' guard asks Asaas before it refuses", () => {
  const remote = (over: Record<string, unknown>) => ({ id: "sub_old", status: "ACTIVE", value: 24.9, nextDueDate: "2026-12-20", cycle: "MONTHLY", billingType: "PIX", customer: "cus_1", ...over }) as AsaasSubscription
  async function withActiveRow(over: Partial<Record<keyof AsaasClient, unknown>>) {
    const t = setup(over)
    const row = await t.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_old", planPeriod: "monthly", method: "pix", status: "active" })
    return { ...t, row }
  }

  it("active in our database and active at Asaas: refused, nothing created", async () => {
    const t = await withActiveRow({ getSubscription: async () => remote({}) })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: false, status: 409, error: "Você já tem uma assinatura ativa." })
    expect(t.calls.some((c) => c.op === "createSubscription")).toBe(false)
    expect(t.subscriptions[0].status).toBe("active")
  })
  it("active in our database but deleted at Asaas: the row is healed to ended and the new checkout goes on", async () => {
    for (const body of [remote({ deleted: true }), remote({ status: "INACTIVE" }), remote({ status: "EXPIRED" })]) {
      const t = await withActiveRow({ getSubscription: async () => body })
      const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
      expect(result).toMatchObject({ ok: true, kind: "pix" })
      expect(t.subscriptions.find((s) => s.id === t.row.id)).toMatchObject({ status: "ended", cancelAtPeriodEnd: true })
    }
  })
  it("not found at Asaas counts as gone", async () => {
    const t = await withActiveRow({ getSubscription: async () => Promise.reject(new AsaasError("x", 404)) })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: true })
    expect(t.subscriptions.find((s) => s.id === t.row.id)?.status).toBe("ended")
  })
  it("Asaas unreachable: the guard stays, with a friendly retry message, and nothing is created or changed", async () => {
    for (const failure of [new AsaasError("x", 500), new AsaasError("x", 0), new Error("boom")]) {
      console.error = vi.fn()
      const t = await withActiveRow({ getSubscription: async () => Promise.reject(failure) })
      expect(await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toEqual({ ok: false, status: 503, error: UNREACHABLE_MESSAGE })
      expect(t.calls.some((c) => c.op === "createSubscription" || c.op === "createCustomer")).toBe(false)
      expect(t.subscriptions[0].status).toBe("active")
    }
  })
  it("an overdue subscription is checked the same way, and a row without an Asaas id counts as gone", async () => {
    const overdue = await withActiveRow({ getSubscription: async () => remote({ deleted: true }) })
    await overdue.store.patchSubscription(overdue.row.id, { status: "overdue" })
    expect(await startCheckout(overdue.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: true })

    const noId = setup()
    await noId.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "", planPeriod: "monthly", method: "pix", status: "active" })
    expect(await subscriptionAtAsaas({ getSubscription: async () => remote({}) }, null)).toBe("gone")
    expect(await subscriptionAtAsaas({ getSubscription: async () => remote({}) }, "sub_old")).toBe("live")
  })
  it("a subscription already flagged to end at the period end does not block a new one", async () => {
    const t = await withActiveRow({ getSubscription: async () => remote({}) })
    await t.store.patchSubscription(t.row.id, { cancelAtPeriodEnd: true })
    expect(await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: true })
    expect(t.calls.some((c) => c.op === "getSubscription")).toBe(false)
  })
})

describe("the launch price depends on paid invoices, not on subscription rows", () => {
  const paid = (over: Partial<Parameters<ReturnType<typeof memoryBillingStore>["store"]["upsertInvoice"]>[0]> = {}) => ({ userId: "u1", asaasSubscriptionId: "sub_old", asaasPaymentId: "pay_old", amountCents: 500, status: "RECEIVED", method: "pix", dueDate: "2026-10-01", paidAt: "2026-10-01T12:00:00Z", invoiceUrl: null, description: null, ...over })

  it("a new account is eligible", async () => {
    expect(await isLaunchEligible(memoryBillingStore().store, "u1")).toBe(true)
  })
  it("canceled or ended subscriptions with NO paid invoice (abandoned checkouts, a deleted test subscription) still get the launch price", async () => {
    const t = setup()
    for (const status of ["canceled", "ended", "pending"] as const) await t.store.insertSubscription({ userId: "u1", asaasSubscriptionId: `sub_${status}`, planPeriod: "monthly", method: "pix", status })
    await t.store.upsertInvoice(paid({ status: "PENDING", paidAt: null, asaasPaymentId: "pay_unpaid" }))
    await t.store.upsertInvoice(paid({ status: "OVERDUE", paidAt: null, asaasPaymentId: "pay_overdue" }))
    expect(await isLaunchEligible(t.store, "u1")).toBe(true)
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, amountCents: 500 })
  })
  it("a cancelled-then-reactivated account is treated the same every time: after one paid invoice, full price", async () => {
    const t = setup()
    await t.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_old", planPeriod: "monthly", method: "pix", status: "ended" })
    await t.store.upsertInvoice(paid())
    expect(await isLaunchEligible(t.store, "u1")).toBe(false)
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, amountCents: 2490 })
    expect(t.calls.some((c) => c.op === "updatePayment")).toBe(false)
  })
  it("a paid status or a payment date both count, and a refunded invoice was still paid once", async () => {
    for (const over of [{ status: "CONFIRMED", paidAt: null }, { status: "RECEIVED_IN_CASH", paidAt: null }, { status: "REFUNDED", paidAt: "2026-10-01T12:00:00Z" }]) {
      const t = setup()
      await t.store.upsertInvoice(paid(over))
      expect(await isLaunchEligible(t.store, "u1")).toBe(false)
    }
  })
  it("someone else's paid invoice changes nothing", async () => {
    const t = setup()
    await t.store.upsertInvoice(paid({ userId: "u2" }))
    expect(await isLaunchEligible(t.store, "u1")).toBe(true)
  })
})
