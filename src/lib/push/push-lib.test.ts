import { createECDH } from "node:crypto"

import { describe, expect, it } from "vitest"

import { classifyPushError, endpointHost, PUSH_FAILURE_MESSAGES } from "./failures"
import { cleanKey, normalizeSubject, vapidProblem } from "./vapid"

const pair = () => {
  const ecdh = createECDH("prime256v1")
  ecdh.generateKeys()
  return { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: ecdh.getPrivateKey().toString("base64url") }
}

describe("vapidProblem", () => {
  it("accepts a matching pair, also when the values were pasted with spaces, quotes or a line break", () => {
    const keys = pair()
    expect(vapidProblem(keys)).toBeNull()
    expect(vapidProblem({ publicKey: ` "${keys.publicKey}"\n`, privateKey: `${keys.privateKey}\r\n` })).toBeNull()
    expect(cleanKey(`  'abc'\n`)).toBe("abc")
  })
  it("names what is wrong", () => {
    const a = pair()
    const b = pair()
    expect(vapidProblem({ publicKey: "", privateKey: a.privateKey })).toBe("missing_public")
    expect(vapidProblem({ publicKey: a.publicKey, privateKey: undefined })).toBe("missing_private")
    expect(vapidProblem({ publicKey: "não-é-base64", privateKey: a.privateKey })).toBe("public_invalid")
    expect(vapidProblem({ publicKey: a.publicKey.slice(0, 40), privateKey: a.privateKey })).toBe("public_invalid")
    expect(vapidProblem({ publicKey: a.publicKey, privateKey: "curta" })).toBe("private_invalid")
    // the public key of one pair with the private key of another: the push service would answer 401/403
    expect(vapidProblem({ publicKey: a.publicKey, privateKey: b.privateKey })).toBe("keys_mismatch")
  })
})

describe("normalizeSubject", () => {
  it("accepts mailto: and https, fixes a bare e-mail, falls back for anything else", () => {
    expect(normalizeSubject("mailto:organizzouapp@gmail.com")).toEqual({ subject: "mailto:organizzouapp@gmail.com", valid: true })
    expect(normalizeSubject("organizzouapp@gmail.com")).toEqual({ subject: "mailto:organizzouapp@gmail.com", valid: true })
    expect(normalizeSubject("https://organizzou.com")).toEqual({ subject: "https://organizzou.com", valid: true })
    expect(normalizeSubject("")).toEqual({ subject: "mailto:organizzouapp@gmail.com", valid: true })
    expect(normalizeSubject("http://inseguro.com")).toEqual({ subject: "mailto:organizzouapp@gmail.com", valid: false })
    expect(normalizeSubject("não é nada")).toEqual({ subject: "mailto:organizzouapp@gmail.com", valid: false })
  })
})

describe("classifyPushError", () => {
  it("maps the push service statuses to a reason, and only 404/410 remove the device", () => {
    expect(classifyPushError({ statusCode: 410 })).toEqual({ code: "gone", status: 410, remove: true })
    expect(classifyPushError({ statusCode: 404 }).remove).toBe(true)
    expect(classifyPushError({ statusCode: 401 })).toMatchObject({ code: "vapid_rejected", remove: false })
    expect(classifyPushError({ statusCode: 403 }).code).toBe("vapid_rejected")
    expect(classifyPushError({ statusCode: 400 }).code).toBe("bad_request")
    expect(classifyPushError({ statusCode: 413 }).code).toBe("payload_too_large")
    expect(classifyPushError({ statusCode: 429 }).code).toBe("rate_limited")
    expect(classifyPushError({ statusCode: 503 }).code).toBe("server_error")
    expect(classifyPushError({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND fcm.googleapis.com" }).code).toBe("network")
    expect(classifyPushError(new Error("algo estranho")).code).toBe("unknown")
    expect(classifyPushError(undefined).code).toBe("unknown")
  })
  it("every reason has a pt-BR sentence, and only the host of an endpoint is ever used", () => {
    for (const code of ["gone", "vapid_rejected", "bad_request", "payload_too_large", "rate_limited", "server_error", "network", "unknown"] as const) expect(PUSH_FAILURE_MESSAGES[code].length).toBeGreaterThan(20)
    expect(endpointHost("https://fcm.googleapis.com/fcm/send/abc:SECRET")).toBe("fcm.googleapis.com")
    expect(endpointHost("lixo")).toBe("invalid")
  })
})
