import { createHash, generateKeyPairSync, sign } from "node:crypto"

import { describe, expect, it } from "vitest"

import { challengeProblem, passkeyFailMessage, toBase64Url, userHandle } from "./passkey"
import { classifyVerifyError, userIdFromHandle, verifyLoginAssertion } from "./passkey-verify"

// Real assertions, signed locally with an ES256 key, exactly the bytes a platform authenticator would send.
const RP_ID = "organizzou.com"
const ORIGIN = "https://organizzou.com"
const USER_ID = "7b9f1c2e-1111-4222-8333-444455556666"
const CHALLENGE = "Y2hhbGxlbmdlLWZvci10aGlzLXRlc3Q"

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string }
const raw = (b64url: string) => Buffer.from(b64url, "base64url")
// COSE_Key for ES256: {1: 2, 3: -7, -1: 1, -2: x, -3: y}
const cosePublicKey = Buffer.concat([Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]), raw(jwk.x), Buffer.from([0x22, 0x58, 0x20]), raw(jwk.y)])
const STORED_KEY = toBase64Url(cosePublicKey)

function assertion(over: { counter?: number; challenge?: string; origin?: string; rpID?: string; uv?: boolean; userHandle?: string | null; id?: string } = {}) {
  const counter = Buffer.alloc(4)
  counter.writeUInt32BE(over.counter ?? 0)
  const flags = Buffer.from([0x01 | (over.uv === false ? 0 : 0x04)])
  const authenticatorData = Buffer.concat([createHash("sha256").update(over.rpID ?? RP_ID).digest(), flags, counter])
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: over.challenge ?? CHALLENGE, origin: over.origin ?? ORIGIN, crossOrigin: false }))
  const signature = sign("sha256", Buffer.concat([authenticatorData, createHash("sha256").update(clientDataJSON).digest()]), privateKey)
  const id = over.id ?? "AQIDBAUGBwgJCgsMDQ4PEA"
  return {
    id,
    rawId: id,
    type: "public-key" as const,
    clientExtensionResults: {},
    response: {
      clientDataJSON: toBase64Url(clientDataJSON),
      authenticatorData: toBase64Url(authenticatorData),
      signature: toBase64Url(signature),
      ...(over.userHandle === null ? {} : { userHandle: over.userHandle ?? toBase64Url(userHandle(USER_ID)) }),
    },
  }
}

const stored = (counter: number) => ({ user_id: USER_ID, public_key: STORED_KEY, counter, transports: ["internal"] })
const verify = (response: ReturnType<typeof assertion>, counter: number, extra: Partial<Parameters<typeof verifyLoginAssertion>[0]> = {}) => verifyLoginAssertion({ response, challenge: CHALLENGE, credential: stored(counter), rpID: RP_ID, origins: [ORIGIN], ...extra })

describe("passkey sign-in verification", () => {
  it("accepts an authenticator whose counter stays at 0 (Windows Hello and many platform passkeys)", async () => {
    expect(await verify(assertion({ counter: 0 }), 0)).toEqual({ ok: true, newCounter: 0 })
    // and again on the next sign-in: still 0 against a stored 0
    expect(await verify(assertion({ counter: 0 }), 0)).toEqual({ ok: true, newCounter: 0 })
  })

  it("accepts a counter that goes up, and refuses one that does not once counting has started", async () => {
    expect(await verify(assertion({ counter: 8 }), 7)).toEqual({ ok: true, newCounter: 8 })
    expect(await verify(assertion({ counter: 7 }), 7)).toEqual({ ok: false, reason: "counter" })
    expect(await verify(assertion({ counter: 3 }), 7)).toEqual({ ok: false, reason: "counter" })
  })

  it("a discoverable credential (no e-mail typed): the userHandle names the account and must match the stored one", async () => {
    expect(await verify(assertion({ userHandle: toBase64Url(userHandle(USER_ID)) }), 0)).toMatchObject({ ok: true })
    // the authenticator may send no userHandle at all (non-discoverable use): the credential id alone identifies it
    expect(await verify(assertion({ userHandle: null }), 0)).toMatchObject({ ok: true })
    const other = toBase64Url(userHandle("00000000-0000-4000-8000-000000000009"))
    expect(await verify(assertion({ userHandle: other }), 0)).toEqual({ ok: false, reason: "user_handle_mismatch" })
  })

  it("names the reason when the site id, origin or challenge do not match", async () => {
    expect(await verify(assertion({ rpID: "localhost" }), 0)).toEqual({ ok: false, reason: "rpid_mismatch" })
    expect(await verify(assertion({ origin: "https://outro.exemplo" }), 0)).toEqual({ ok: false, reason: "origin_mismatch" })
    expect(await verify(assertion({ challenge: "outro-desafio" }), 0)).toEqual({ ok: false, reason: "challenge_wrong" })
    expect(await verify(assertion({ uv: false }), 0)).toEqual({ ok: false, reason: "user_not_verified" })
  })

  it("an origin with a trailing slash would be a broken server setting (the config reader strips it); it is reported as such", async () => {
    expect(await verify(assertion(), 0, { origins: [ORIGIN] })).toMatchObject({ ok: true })
    expect(await verify(assertion(), 0, { origins: ["https://organizzou.com/"] })).toEqual({ ok: false, reason: "bad_config" })
  })

  it("the same id verifies on the apex, on www and on the old host while it is listed, and a passkey made for another id is refused", async () => {
    const origins = ["https://organizzou.com", "https://www.organizzou.com", "https://organizzou.vercel.app"]
    for (const origin of origins) expect(await verify(assertion({ origin }), 0, { origins })).toMatchObject({ ok: true })
    // registered under the old id: its authenticator data carries the hash of organizzou.vercel.app, so it cannot sign in on organizzou.com
    expect(await verify(assertion({ rpID: "organizzou.vercel.app" }), 0, { origins })).toEqual({ ok: false, reason: "rpid_mismatch" })
    // an origin that is not listed is refused
    expect(await verify(assertion({ origin: "https://organizzou.vercel.app" }), 0, { origins: ["https://organizzou.com"] })).toEqual({ ok: false, reason: "origin_mismatch" })
  })

  it("a signature made by another key is refused", async () => {
    const other = generateKeyPairSync("ec", { namedCurve: "P-256" })
    const j = other.publicKey.export({ format: "jwk" }) as { x: string; y: string }
    const key = toBase64Url(Buffer.concat([Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]), raw(j.x), Buffer.from([0x22, 0x58, 0x20]), raw(j.y)]))
    const result = await verifyLoginAssertion({ response: assertion(), challenge: CHALLENGE, credential: { ...stored(0), public_key: key }, rpID: RP_ID, origins: [ORIGIN] })
    expect(result).toEqual({ ok: false, reason: "verify_failed" })
  })
})

describe("reasons and messages", () => {
  it("classifies the library errors without passing their text on", () => {
    expect(classifyVerifyError("Response counter value 3 was lower than expected 7")).toBe("counter")
    expect(classifyVerifyError("Unexpected RP ID hash")).toBe("rpid_mismatch")
    expect(classifyVerifyError('Unexpected response origin "https://x", expected one of: https://y')).toBe("origin_mismatch")
    expect(classifyVerifyError("Unexpected authentication response challenge")).toBe("challenge_wrong")
    expect(classifyVerifyError("something else")).toBe("verify_failed")
    expect(classifyVerifyError("x", "UNEXPECTED_ORIGIN")).toBe("origin_mismatch")
    expect(classifyVerifyError("x", "BAD_ARGUMENT")).toBe("bad_config")
  })
  it("reads the account from a userHandle", () => {
    expect(userIdFromHandle(toBase64Url(userHandle(USER_ID)))).toBe(USER_ID)
    expect(userIdFromHandle(undefined)).toBeNull()
  })
  it("a stored challenge says why it cannot be used", () => {
    const now = Date.parse("2026-11-16T12:00:00Z")
    const row = { purpose: "login", user_id: null, expires_at: "2026-11-16T12:04:00Z", consumed_at: null }
    expect(challengeProblem(row, "login", null, now)).toBeNull()
    expect(challengeProblem(null, "login", null, now)).toBe("challenge_missing")
    expect(challengeProblem({ ...row, purpose: "register" }, "login", null, now)).toBe("challenge_mismatch")
    expect(challengeProblem({ ...row, consumed_at: "2026-11-16T11:59:00Z" }, "login", null, now)).toBe("challenge_used")
    expect(challengeProblem({ ...row, expires_at: "2026-11-16T11:00:00Z" }, "login", null, now)).toBe("challenge_expired")
  })
  it("the screen gets a precise pt-BR sentence for the common cases and a generic one otherwise", () => {
    expect(passkeyFailMessage("credential_not_found")).toMatch(/não está cadastrada neste site/)
    expect(passkeyFailMessage("challenge_expired")).toMatch(/expirou/)
    expect(passkeyFailMessage("session_failed")).toMatch(/abrir sua sessão/)
    expect(passkeyFailMessage(undefined)).toMatch(/Não consegui entrar com a passkey/)
    expect(passkeyFailMessage("something_new")).toMatch(/Não consegui entrar com a passkey/)
  })
})
