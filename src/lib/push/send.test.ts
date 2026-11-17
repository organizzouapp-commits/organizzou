import { createECDH } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const calls: { endpoint: string; options: Record<string, unknown>; body: string }[] = []
const behaviour = { fail: {} as Record<string, unknown> }

vi.mock("server-only", () => ({}))
vi.mock("web-push", () => ({
  setVapidDetails: () => undefined,
  sendNotification: async (subscription: { endpoint: string }, body: string, options: Record<string, unknown>) => {
    calls.push({ endpoint: subscription.endpoint, options, body })
    const error = behaviour.fail[subscription.endpoint]
    if (error) throw error
    return { statusCode: 201 }
  },
}))

import { PUSH_TTL_SECONDS, sendToUser } from "./send"

const ecdh = createECDH("prime256v1")
ecdh.generateKeys()
const PUBLIC = ecdh.getPublicKey().toString("base64url")
const PRIVATE = ecdh.getPrivateKey().toString("base64url")

const rows = [
  { id: "r1", endpoint: "https://fcm.googleapis.com/fcm/send/SECRET-ONE", p256dh: "p", auth: "a" },
  { id: "r2", endpoint: "https://updates.push.services.mozilla.com/wpush/v2/SECRET-TWO", p256dh: "p", auth: "a" },
  { id: "r3", endpoint: "https://wns2.notify.windows.com/w/?token=SECRET-THREE", p256dh: "p", auth: "a" },
]
const deleted: string[][] = []
const db = {
  from: () => ({
    select: () => ({ eq: () => ({ eq: async () => ({ data: rows.slice(0, 1) }), then: (resolve: (value: unknown) => void) => resolve({ data: rows }) }) }),
    delete: () => ({ in: async (_c: string, ids: string[]) => void deleted.push(ids) }),
  }),
} as never

let logs: string[] = []
const realWarn = console.warn

beforeEach(() => {
  calls.length = 0
  deleted.length = 0
  behaviour.fail = {}
  logs = []
  console.warn = (message: unknown) => void logs.push(String(message))
  process.env.VAPID_PUBLIC_KEY = PUBLIC
  process.env.VAPID_PRIVATE_KEY = PRIVATE
  process.env.VAPID_SUBJECT = "organizzouapp@gmail.com"
})
afterEach(() => {
  console.warn = realWarn
})

const payload = { title: "Organizzou", body: "Teste", url: "/dashboard", tag: "test", sticky: true }

describe("sendToUser", () => {
  it("sends every push with urgency high and a one hour TTL, and counts the deliveries", async () => {
    const result = await sendToUser(db, "u1", payload)
    expect(result).toMatchObject({ sent: 3, failed: 0, removed: 0, devices: 3, failures: {} })
    expect(PUSH_TTL_SECONDS).toBe(3600)
    for (const call of calls) expect(call.options).toMatchObject({ TTL: 3600, urgency: "high" })
    expect(JSON.parse(calls[0].body)).toMatchObject({ title: "Organizzou", tag: "test", sticky: true })
  })

  it("reports each failure by reason, removes dead devices, and never logs an endpoint or a key", async () => {
    behaviour.fail[rows[0].endpoint] = Object.assign(new Error("Received unexpected response code"), { statusCode: 403 })
    behaviour.fail[rows[1].endpoint] = Object.assign(new Error("gone"), { statusCode: 410 })
    const result = await sendToUser(db, "u1", payload)
    expect(result).toMatchObject({ sent: 1, failed: 1, removed: 1, devices: 3, failures: { vapid_rejected: 1, gone: 1 } })
    expect(deleted).toEqual([["r2"]])
    const log = logs.join("\n")
    expect(log).toMatch(/send_failed status=403 reason=vapid_rejected host=fcm\.googleapis\.com/)
    expect(log).toMatch(/send_failed status=410 reason=gone host=updates\.push\.services\.mozilla\.com/)
    expect(log).not.toMatch(/SECRET|token=|wpush|fcm\/send/)
    expect(log).not.toContain(PRIVATE)
    expect(log).not.toContain(PUBLIC)
  })

  it("a broken key pair attempts nothing and says why", async () => {
    const other = createECDH("prime256v1")
    other.generateKeys()
    process.env.VAPID_PUBLIC_KEY = other.getPublicKey().toString("base64url")
    const result = await sendToUser(db, "u1", payload)
    expect(result).toMatchObject({ sent: 0, devices: 0, problem: "keys_mismatch" })
    expect(calls).toHaveLength(0)
  })

  it("one device only when asked for it", async () => {
    const result = await sendToUser(db, "u1", payload, "r1")
    expect(result).toMatchObject({ sent: 1, devices: 1 })
  })
})
