import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { canonicalRedirect } from "@/lib/canonical-host"

// A query builder that finds nothing: enough for a run with no subscribed people.
const chain = () => {
  const q: Record<string, unknown> = { select: () => q, gte: () => q, lte: () => q, not: () => q, limit: async () => ({ data: [] }) }
  return q
}

vi.mock("server-only", () => ({}))
vi.mock("@/lib/admin/secret", () => ({ secretKeyConfigured: () => true, createSecretClient: () => ({ from: () => chain() }) }))
vi.mock("@/lib/push/send", () => ({ vapidConfigProblem: () => (process.env.TEST_PUSH_PROBLEM ? "keys_mismatch" : null), sendToUser: async () => ({ sent: 0, failed: 0, removed: 0, devices: 0, failures: {} }) }))

import { GET } from "@/app/api/cron/notifications/route"

const call = (authorization?: string, query = "") => GET(new NextRequest(`https://organizzou.com/api/cron/notifications${query}`, { headers: authorization ? { authorization } : {} }))
const env = process.env as Record<string, string | undefined>
const realWarn = console.warn

beforeEach(() => {
  env.CRON_SECRET = "segredo-do-cron-com-bastante-tamanho"
  delete env.TEST_PUSH_PROBLEM
  console.warn = () => undefined
})
afterEach(() => {
  console.warn = realWarn
})

describe("/api/cron/notifications", () => {
  it("answers 401 without the Bearer secret, with a wrong one, and when CRON_SECRET is not set", async () => {
    expect((await call()).status).toBe(401)
    expect((await call("Bearer errado")).status).toBe(401)
    delete env.CRON_SECRET
    expect((await call("Bearer undefined")).status).toBe(401)
  })

  it("with the right secret it returns a JSON summary for debugging (due, sent, failed, skipped)", async () => {
    const response = await call(`Bearer ${env.CRON_SECRET}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, users: 0, due: 0, sent: 0, failed: 0, skipped: 0 })
  })

  it("?dryRun=1 needs the same secret, sends nothing and still answers when the keys are broken (to debug them)", async () => {
    expect((await call(undefined, "?dryRun=1")).status).toBe(401)
    const ok = await (await call(`Bearer ${env.CRON_SECRET}`, "?dryRun=1")).json()
    expect(ok).toMatchObject({ ok: true, dryRun: true, due: 0, sent: 0, noSource: ["workout", "meals"], kinds: {} })
    env.TEST_PUSH_PROBLEM = "1"
    expect(await (await call(`Bearer ${env.CRON_SECRET}`, "?dryRun=1")).json()).toMatchObject({ ok: true, dryRun: true, pushProblem: "keys_mismatch" })
  })

  it("says what is wrong with the keys instead of silently doing nothing", async () => {
    env.TEST_PUSH_PROBLEM = "1"
    const body = await (await call(`Bearer ${env.CRON_SECRET}`)).json()
    expect(body).toMatchObject({ ok: false, problem: "keys_mismatch" })
  })

  it("is never redirected by the host rule, on any host", () => {
    for (const host of ["organizzou.vercel.app", "www.organizzou.com"]) expect(canonicalRedirect({ host, pathname: "/api/cron/notifications", search: "", vercelEnv: "production", siteUrl: "https://organizzou.com" })).toBeNull()
  })
})
