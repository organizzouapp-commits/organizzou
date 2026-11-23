import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { AsaasError, type AsaasClient, type AsaasPayment } from "./asaas"
import { memoryBillingStore } from "./memory-store"
import { cancelSubscription, changePlan, getStatus, startCheckout, type BillingUser, type Deps } from "./service"

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
  it("monthly with card: the subscription is R$ 24,90, the FIRST charge is edited to R$ 4,90, and the person is sent to the hosted page", async () => {
    const t = setup()
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, kind: "redirect", url: "https://asaas.test/i/pay_1", amountCents: 490 })
    const sub = t.calls.find((c) => c.op === "createSubscription")!.args[0] as Record<string, unknown>
    expect(sub).toMatchObject({ customer: "cus_1", billingType: "CREDIT_CARD", value: 24.9, cycle: "MONTHLY", nextDueDate: "2026-11-20", externalReference: "u1" })
    expect((sub.callback as { successUrl: string }).successUrl).toBe("https://organizzou.com/dashboard/configuracoes?aba=plano&pagamento=retorno")
    expect(t.calls.find((c) => c.op === "updatePayment")!.args).toEqual(["pay_1", expect.objectContaining({ value: 4.9, dueDate: "2026-11-20", billingType: "CREDIT_CARD" })])
    // stored as pending, with the first invoice at R$ 4,90 and the CPF kept only in our store
    expect(t.subscriptions[0]).toMatchObject({ status: "pending", planPeriod: "monthly", method: "card" })
    expect(t.invoices[0]).toMatchObject({ amountCents: 490, asaasPaymentId: "pay_1" })
    expect(t.customers.get("u1")).toEqual({ asaasCustomerId: "cus_1", cpfCnpj: "52998224725" })
  })
  it("Pix answers with the QR code and the copy-and-paste text, and boleto with the slip page", async () => {
    const pix = setup()
    expect(await startCheckout(pix.deps, USER, { period: "monthly", method: "pix", cpfCnpj: CPF })).toMatchObject({ ok: true, kind: "pix", qrImage: "BASE64", payload: "000201...", expiresAt: "2026-11-21 23:59:59", amountCents: 490 })
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
    await t.store.upsertInvoice({ userId: "u1", asaasSubscriptionId: null, asaasPaymentId: "old", amountCents: 490, status: "RECEIVED", method: "card", dueDate: "2026-01-01", paidAt: "2026-01-01T00:00:00Z", invoiceUrl: null, description: null })
    const result = await startCheckout(t.deps, USER, { period: "monthly", method: "card", cpfCnpj: CPF })
    expect(result).toMatchObject({ ok: true, amountCents: 2490 })
    expect(t.calls.some((c) => c.op === "updatePayment")).toBe(false)
  })
  it("if the R$ 4,90 edit fails the subscription is deleted and nothing is charged", async () => {
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
