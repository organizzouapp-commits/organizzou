import { beforeEach, describe, expect, it, vi } from "vitest"

// The action talks to Supabase through the secret client; here that client is a small in-memory stand-in so the three ways a plan
// change can go wrong are exercised: no profile row, a write the database does not keep, and a missing secret key.
const h = vi.hoisted(() => ({
  keyConfigured: true,
  profiles: new Map<string, { plan: string | null; plan_until: string | null; display_name?: string | null }>(),
  history: [] as unknown[],
  audit: [] as unknown[],
  /** The update "succeeds" but the database keeps nothing (what a silent policy or trigger would look like). */
  dropWrites: false,
  updateError: null as string | null,
  /** What ending the paid subscription answers (the billing module has its own tests). */
  revoke: { ok: true, ended: false, subscriptionId: null } as { ok: true; ended: boolean; subscriptionId: string | null } | { ok: false; error: string },
  revokeCalls: 0,
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/admin/data", () => ({ listUsers: vi.fn(), waitlistList: vi.fn() }))
vi.mock("@/lib/billing/revoke", () => ({
  endSubscriptionForRevoke: async () => {
    h.revokeCalls++
    return h.revoke
  },
}))
vi.mock("@/lib/billing/asaas", () => ({ asaasFromEnv: () => null }))
vi.mock("@/lib/billing/store", () => ({ supabaseBillingStore: () => ({}) }))
vi.mock("@/lib/admin/guard", () => ({ requireAdminForAction: async () => ({ adminId: "admin-1", email: "admin@organizzou.app" }) }))
vi.mock("@/lib/admin/audit", () => ({
  logAdminAction: vi.fn(async (_c: unknown, entry: unknown) => {
    h.audit.push(entry)
    return { ok: true }
  }),
}))
vi.mock("@/lib/admin/secret", () => {
  const client = {
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: "pessoa@exemplo.com", user_metadata: { full_name: "Pessoa Teste" } } }, error: null }) } },
    from(table: string) {
      if (table === "plan_history") return { insert: async (row: unknown) => (h.history.push(row), { error: null }) }
      return {
        update: (values: { plan: string; plan_until: string | null }) => ({
          eq: (_col: string, id: string) => ({
            select: async () => {
              if (h.updateError) return { data: null, error: { message: h.updateError } }
              if (!h.profiles.has(id)) return { data: [], error: null } // Postgres: zero rows matched is not an error
              if (!h.dropWrites) h.profiles.set(id, { ...h.profiles.get(id)!, ...values })
              return { data: [{ id }], error: null }
            },
          }),
        }),
        insert: (row: { id: string; plan: string; plan_until: string | null; display_name: string | null }) => ({
          select: async () => {
            h.profiles.set(row.id, { plan: row.plan, plan_until: row.plan_until, display_name: row.display_name })
            return { data: [{ id: row.id }], error: null }
          },
        }),
        select: () => ({ eq: (_col: string, id: string) => ({ maybeSingle: async () => ({ data: h.profiles.get(id) ?? null, error: null }) }) }),
      }
    },
  }
  return { createSecretClient: () => client, secretKeyConfigured: () => h.keyConfigured, SECRET_KEY_HINT: "Defina SUPABASE_SECRET_KEY no .env.local." }
})

import { changePlan } from "./actions"

const USER = "11111111-1111-4111-8111-111111111111"

beforeEach(() => {
  h.keyConfigured = true
  h.profiles = new Map()
  h.history = []
  h.audit = []
  h.dropWrites = false
  h.updateError = null
  h.revoke = { ok: true, ended: false, subscriptionId: null }
  h.revokeCalls = 0
})

describe("changePlan", () => {
  it("changes the plan, reads it back, then writes the history and the audit entry", async () => {
    h.profiles.set(USER, { plan: null, plan_until: null })
    const result = await changePlan({ userId: USER, plan: "pro" })
    expect(result).toEqual({ ok: true, message: "Plano Pro ativado." })
    expect(h.profiles.get(USER)?.plan).toBe("pro")
    expect(h.history).toHaveLength(1)
    expect(h.audit).toEqual([expect.objectContaining({ action: "plan.change", targetUserId: USER, payload: { plan: "pro", until: null, subscription_ended: false } })])
  })

  it("an account with NO profile row gets one (the root cause of 'Pro does not stick'), and the plan really changes", async () => {
    const result = await changePlan({ userId: USER, plan: "pro" })
    expect(result.ok).toBe(true)
    expect(h.profiles.get(USER)).toMatchObject({ plan: "pro", display_name: "Pessoa Teste" })
    expect(h.audit).toHaveLength(1)
  })

  it("a courtesy Pro keeps its end date, and the read-back compares it", async () => {
    h.profiles.set(USER, { plan: null, plan_until: null })
    const until = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
    const result = await changePlan({ userId: USER, plan: "pro", until })
    expect(result).toEqual({ ok: true, message: "Pro de cortesia ativado." })
    expect(new Date(h.profiles.get(USER)!.plan_until!).getTime()).toBe(new Date(`${until}T23:59:59-03:00`).getTime())
  })

  it("never fakes success: a write the database does not keep is an error, with no history and no audit entry", async () => {
    h.profiles.set(USER, { plan: null, plan_until: null })
    h.dropWrites = true
    const result = await changePlan({ userId: USER, plan: "pro" })
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/^Não consegui alterar o plano\. O banco não guardou a mudança/) })
    expect(h.history).toHaveLength(0)
    expect(h.audit).toHaveLength(0)
  })

  it("a refused write says why", async () => {
    h.profiles.set(USER, { plan: null, plan_until: null })
    h.updateError = "plan can only be changed by the service role"
    const result = await changePlan({ userId: USER, plan: "pro" })
    expect(result).toEqual({ ok: false, error: expect.stringContaining("plan can only be changed by the service role") })
    expect(h.audit).toHaveLength(0)
  })

  it("a missing secret key is an honest error and nothing is written", async () => {
    h.keyConfigured = false
    h.profiles.set(USER, { plan: null, plan_until: null })
    const result = await changePlan({ userId: USER, plan: "pro" })
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/^Não consegui alterar o plano\. .*SUPABASE_SECRET_KEY/) })
    expect(h.profiles.get(USER)?.plan).toBeNull()
    expect(h.history).toHaveLength(0)
  })

  it("rejects a courtesy end date in the past", async () => {
    h.profiles.set(USER, { plan: null, plan_until: null })
    const result = await changePlan({ userId: USER, plan: "pro", until: "2020-01-01" })
    expect(result.ok).toBe(false)
    expect(h.profiles.get(USER)?.plan).toBeNull()
  })
})

describe("changePlan and the paid subscription", () => {
  it("going back to Free cancels the subscription first, audits it, and says so", async () => {
    h.profiles.set(USER, { plan: "pro", plan_until: null })
    h.revoke = { ok: true, ended: true, subscriptionId: "sub_1" }
    const result = await changePlan({ userId: USER, plan: "free" })
    expect(result).toEqual({ ok: true, message: "Plano alterado para Gratuito e a assinatura foi cancelada no Asaas." })
    expect(h.profiles.get(USER)?.plan).toBe("free")
    expect(h.audit.map((a) => (a as { action: string }).action)).toEqual(["billing.subscription_end", "plan.change"])
    expect(h.audit[1]).toMatchObject({ payload: { plan: "free", until: null, subscription_ended: true } })
    // the payload of the cancel entry holds the Asaas subscription id and the reason, nothing personal
    expect((h.audit[0] as { payload: unknown }).payload).toEqual({ subscription: "sub_1", via: "revoke_pro" })
  })
  it("if the subscription cannot be cancelled the plan is NOT changed and the admin reads why", async () => {
    h.profiles.set(USER, { plan: "pro", plan_until: null })
    h.revoke = { ok: false, error: "O Asaas não aceitou cancelar a assinatura (status 500). Nada foi alterado: o plano e a assinatura continuam como estavam." }
    const result = await changePlan({ userId: USER, plan: "free" })
    expect(result).toEqual({ ok: false, error: expect.stringContaining("Nada foi alterado") })
    expect(h.profiles.get(USER)?.plan).toBe("pro")
    expect(h.history).toHaveLength(0)
    expect(h.audit).toHaveLength(0)
  })
  it("if the plan write fails AFTER the subscription ended, the admin is told what was done", async () => {
    h.profiles.set(USER, { plan: "pro", plan_until: null })
    h.revoke = { ok: true, ended: true, subscriptionId: "sub_1" }
    h.dropWrites = true
    const result = await changePlan({ userId: USER, plan: "free" })
    expect(result).toEqual({ ok: false, error: expect.stringContaining("A assinatura já foi cancelada no Asaas e marcada como encerrada, mas o plano continua como estava.") })
    expect(h.audit.map((a) => (a as { action: string }).action)).toEqual(["billing.subscription_end"])
  })
  it("granting Pro by hand never touches the subscription", async () => {
    h.profiles.set(USER, { plan: null, plan_until: null })
    h.revoke = { ok: false, error: "must not be asked" }
    expect((await changePlan({ userId: USER, plan: "pro" })).ok).toBe(true)
    expect(h.revokeCalls).toBe(0)
  })
  it("a Free person with no subscription goes back to Free as before", async () => {
    h.profiles.set(USER, { plan: "pro", plan_until: null })
    expect(await changePlan({ userId: USER, plan: "free" })).toEqual({ ok: true, message: "Plano alterado para Gratuito." })
  })
})
