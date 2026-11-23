import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { AsaasError } from "./asaas"
import { memoryBillingStore } from "./memory-store"
import { endSubscriptionForRevoke } from "./revoke"

const noSleep = async () => undefined
const http500 = () => new AsaasError("x", 500, ["unknown.error"])

async function world(status: "pending" | "active" | "overdue" | "ended" | "canceled" = "active") {
  const m = memoryBillingStore()
  const sub = await m.store.insertSubscription({ userId: "u1", asaasSubscriptionId: "sub_1", planPeriod: "monthly", method: "pix", status })
  return { ...m, sub }
}
const asaasWith = (impl: (id: string) => Promise<unknown>) => {
  const calls: string[] = []
  return { client: { deleteSubscription: async (id: string) => (calls.push(id), impl(id)) } as never, calls }
}

describe("revoking Pro ends the subscription first", () => {
  it("cancels at Asaas, marks the row ended, and reports it", async () => {
    const w = await world()
    const a = asaasWith(async () => ({ deleted: true, id: "sub_1" }))
    expect(await endSubscriptionForRevoke({ asaas: a.client, store: w.store, sleep: noSleep }, "u1")).toEqual({ ok: true, ended: true, subscriptionId: "sub_1" })
    expect(a.calls).toEqual(["sub_1"])
    expect(w.subscriptions[0]).toMatchObject({ status: "ended", cancelAtPeriodEnd: true, graceUntil: null })
  })
  it("a subscription already gone at Asaas (not found) counts as cancelled", async () => {
    const w = await world()
    const a = asaasWith(async () => Promise.reject(new AsaasError("x", 404)))
    expect(await endSubscriptionForRevoke({ asaas: a.client, store: w.store, sleep: noSleep }, "u1")).toMatchObject({ ok: true, ended: true })
    expect(w.subscriptions[0].status).toBe("ended")
  })
  it("retries a 500 and succeeds on the third attempt", async () => {
    const w = await world()
    let n = 0
    const a = asaasWith(async () => (++n < 3 ? Promise.reject(http500()) : { deleted: true, id: "sub_1" }))
    expect(await endSubscriptionForRevoke({ asaas: a.client, store: w.store, sleep: noSleep }, "u1")).toMatchObject({ ok: true, ended: true })
    expect(a.calls).toHaveLength(3)
  })
  it("if Asaas keeps failing nothing is changed: the row stays, and the admin is told exactly that", async () => {
    console.error = vi.fn()
    const w = await world()
    const a = asaasWith(async () => Promise.reject(http500()))
    const result = await endSubscriptionForRevoke({ asaas: a.client, store: w.store, sleep: noSleep }, "u1")
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Nada foi alterado") })
    expect(w.subscriptions[0].status).toBe("active")
    expect(w.orphans).toHaveLength(0) // the row is still ours and live: nothing was left behind
  })
  it("a live subscription with Asaas not configured here is refused with a clear message", async () => {
    const w = await world()
    expect(await endSubscriptionForRevoke({ asaas: null, store: w.store }, "u1")).toMatchObject({ ok: false, error: expect.stringContaining("ASAAS_API_KEY") })
    expect(w.subscriptions[0].status).toBe("active")
  })
  it("pending and overdue subscriptions are ended too; ended, canceled or missing ones need no call", async () => {
    for (const status of ["pending", "overdue"] as const) {
      const w = await world(status)
      const a = asaasWith(async () => ({ deleted: true, id: "sub_1" }))
      expect(await endSubscriptionForRevoke({ asaas: a.client, store: w.store, sleep: noSleep }, "u1")).toMatchObject({ ok: true, ended: true })
    }
    for (const status of ["ended", "canceled"] as const) {
      const w = await world(status)
      const a = asaasWith(async () => ({}))
      expect(await endSubscriptionForRevoke({ asaas: a.client, store: w.store }, "u1")).toEqual({ ok: true, ended: false, subscriptionId: null })
      expect(a.calls).toHaveLength(0)
    }
    expect(await endSubscriptionForRevoke({ asaas: null, store: memoryBillingStore().store }, "nobody")).toEqual({ ok: true, ended: false, subscriptionId: null })
  })
  it("a manual Pro (no subscription row) and a database without the billing tables are simply Free-able", async () => {
    const broken = memoryBillingStore().store
    broken.latestSubscription = async () => {
      throw new Error("relation does not exist")
    }
    expect(await endSubscriptionForRevoke({ asaas: null, store: broken }, "u1")).toEqual({ ok: true, ended: false, subscriptionId: null })
  })
})

describe("the admin action", () => {
  const actions = readFileSync(join(process.cwd(), "src/features/admin/actions.ts"), "utf8")
  it("ends the subscription before it touches the plan, and audits both steps", () => {
    const body = actions.slice(actions.indexOf("export async function changePlan"))
    expect(body.indexOf("endSubscriptionForRevoke(")).toBeGreaterThan(-1)
    expect(body.indexOf("endSubscriptionForRevoke(")).toBeLessThan(body.indexOf('.from("profiles").update('))
    expect(body).toContain('action: "billing.subscription_end"')
    expect(body).toContain('action: "plan.change"')
    expect(body).toContain("if (plan === \"free\")")
  })
  it("granting Pro never creates a subscription row", () => {
    expect(actions).not.toMatch(/insertSubscription|from\("subscriptions"\)/)
  })
  it("when a later step fails the admin is told the subscription is already ended", () => {
    expect(actions).toContain("A assinatura já foi cancelada no Asaas e marcada como encerrada, mas o plano continua como estava.")
  })
})
