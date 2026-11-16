import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The route's sign-in flow with a fake database and a fake Supabase auth: challenge from the cookie, credential by id, verification verdict,
// counter write, one-time link, session. The signature check itself is covered by passkey-verify.test.ts with real assertions.
const CHALLENGE_ID = "11111111-2222-4333-8444-555555555555"
const state = {
  challenge: { challenge: "c", user_id: null as string | null, purpose: "login", expires_at: "2099-01-01T00:00:00Z", consumed_at: null as string | null } as null | Record<string, unknown>,
  credential: { id: "cred-row", user_id: "u1", public_key: "AA", counter: 0, transports: ["internal"] } as null | Record<string, unknown>,
  verdict: { ok: true, newCounter: 0 } as { ok: true; newCounter: number } | { ok: false; reason: string },
  counterWrites: [] as Record<string, unknown>[],
  counterError: null as null | { code: string },
  email: "pessoa@exemplo.com" as string | null,
  linkToken: "hash" as string | null,
  verifyOtpTypes: [] as string[],
  magiclinkWorks: true,
}

vi.mock("@/lib/admin/secret", () => ({
  secretKeyConfigured: () => true,
  createSecretClient: () => ({
    from: (table: string) => {
      if (table === "webauthn_challenges") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          maybeSingle: async () => ({ data: state.challenge }),
          update: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: state.challenge && !state.challenge.consumed_at ? [{ id: CHALLENGE_ID }] : [] }) }) }) }),
        }
        return chain
      }
      // passkey_credentials
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.credential, error: null }) }) }),
        update: (values: Record<string, unknown>) => ({
          eq: async () => {
            state.counterWrites.push(values)
            return { error: state.counterError }
          },
        }),
      }
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: state.email ? { email: state.email } : null }, error: null }),
        generateLink: async () => ({ data: { properties: state.linkToken ? { hashed_token: state.linkToken } : {} }, error: null }),
      },
    },
  }),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: async ({ type }: { type: string }) => {
        state.verifyOtpTypes.push(type)
        const works = type === "magiclink" ? state.magiclinkWorks : true
        return works ? { data: { session: { access_token: `x.${Buffer.from(JSON.stringify({ session_id: "s1" })).toString("base64url")}.y` } }, error: null } : { data: { session: null }, error: { code: "otp_expired", status: 403 } }
      },
    },
  }),
}))

vi.mock("@/features/auth/passkey-verify", () => ({ verifyLoginAssertion: async () => state.verdict }))

import { POST } from "@/app/api/passkey/[action]/route"

const call = (body: unknown = { response: { id: "credential-id" } }, cookie: string | null = `org_wa_challenge=${CHALLENGE_ID}`) =>
  POST(new NextRequest("https://organizzou.com/api/passkey/login-verify", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `ip-${Math.random()}`, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }), { params: Promise.resolve({ action: "login-verify" }) })

let warnings: string[] = []
const realWarn = console.warn
afterEach(() => {
  console.warn = realWarn
})

beforeEach(() => {
  state.challenge = { challenge: "c", user_id: null, purpose: "login", expires_at: "2099-01-01T00:00:00Z", consumed_at: null }
  state.credential = { id: "cred-row", user_id: "u1", public_key: "AA", counter: 0, transports: ["internal"] }
  state.verdict = { ok: true, newCounter: 0 }
  state.counterWrites = []
  state.counterError = null
  state.email = "pessoa@exemplo.com"
  state.linkToken = "hash"
  state.verifyOtpTypes = []
  state.magiclinkWorks = true
  process.env.AUTH_COOKIE_SECRET = "x".repeat(40)
  warnings = []
  console.warn = (message: unknown) => void warnings.push(String(message))
})

describe("passkey sign-in route", () => {
  it("signs in, writes the counter (0 stays 0) and sets the second-step proof", async () => {
    const response = await call()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    expect(state.counterWrites[0]).toMatchObject({ counter: 0 })
    expect(response.headers.get("set-cookie")).toMatch(/org_2fa=/)
  })

  it("still signs in when AUTH_COOKIE_SECRET is not set (it used to fail every sign-in with the generic message)", async () => {
    delete process.env.AUTH_COOKIE_SECRET
    const response = await call()
    expect(response.status).toBe(200)
    expect((await response.json()).ok).toBe(true)
    expect(response.headers.get("set-cookie") ?? "").not.toMatch(/org_2fa=/)
    expect(warnings.join("\n")).toMatch(/AUTH_COOKIE_SECRET/)
  })

  it("a failed counter write does not stop the sign-in, it is logged", async () => {
    state.counterError = { code: "42501" }
    expect((await call()).status).toBe(200)
    expect(warnings.join("\n")).toMatch(/counter_update_failed db=42501/)
  })

  it("falls back to the one-time link type 'email' when 'magiclink' is refused", async () => {
    state.magiclinkWorks = false
    expect((await call()).status).toBe(200)
    expect(state.verifyOtpTypes).toEqual(["magiclink", "email"])
  })

  it("says why it failed, in the log and to the screen, without ids or tokens", async () => {
    const missing = await call(undefined, null)
    expect(await missing.json()).toMatchObject({ ok: false, reason: "challenge_missing", error: expect.stringMatching(/expirou/) })

    state.challenge = { ...state.challenge!, consumed_at: "2026-11-16T00:00:00Z" }
    expect((await (await call()).json()).reason).toBe("challenge_used")
    state.challenge = { ...state.challenge, consumed_at: null, expires_at: "2020-01-01T00:00:00Z" }
    expect((await (await call()).json()).reason).toBe("challenge_expired")
    state.challenge = { ...state.challenge, expires_at: "2099-01-01T00:00:00Z" }

    state.credential = null
    const unknown = await call()
    expect(unknown.status).toBe(401)
    expect(await unknown.json()).toMatchObject({ reason: "credential_not_found", error: expect.stringMatching(/não está cadastrada neste site/) })
    state.credential = { id: "cred-row", user_id: "u1", public_key: "AA", counter: 0, transports: [] }

    state.verdict = { ok: false, reason: "counter" }
    expect((await (await call()).json()).reason).toBe("counter")
    state.verdict = { ok: true, newCounter: 1 }

    state.email = null
    expect((await (await call()).json()).reason).toBe("user_not_found")
    state.email = "pessoa@exemplo.com"
    state.linkToken = null
    expect((await (await call()).json()).reason).toBe("link_failed")

    const log = warnings.join("\n")
    expect(log).toMatch(/\[passkey\] auth_failed reason=challenge_missing/)
    expect(log).toMatch(/reason=credential_not_found/)
    expect(log).not.toMatch(/credential-id|pessoa@exemplo|hash|u1/)
  })
})
