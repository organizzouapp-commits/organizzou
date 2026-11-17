import { describe, expect, it } from "vitest"

import { enableMessage, sameApplicationServerKey, subscribeErrorMessage, testToast, withTimeout, type EnableStep } from "./enable"

describe("enable messages", () => {
  it("every place the flow can stop has its own pt-BR sentence", () => {
    const steps: EnableStep[] = ["no_service_worker", "key_unavailable", "permission_denied", "permission_dismissed", "worker_failed", "worker_not_ready", "subscribe_failed", "save_failed"]
    const texts = steps.map(enableMessage)
    expect(new Set(texts).size).toBe(steps.length)
    for (const text of texts) expect(text.length).toBeGreaterThan(30)
  })
  it("subscribe errors are told apart by name", () => {
    expect(subscribeErrorMessage("NotAllowedError")).toMatch(/bloqueadas/)
    expect(subscribeErrorMessage("InvalidAccessError")).toMatch(/chave/)
    expect(subscribeErrorMessage("AbortError")).toMatch(/serviço de push/)
    expect(subscribeErrorMessage("InvalidStateError")).toMatch(/outra chave/)
    expect(subscribeErrorMessage("SecurityError")).toMatch(/janela/)
    expect(subscribeErrorMessage(undefined)).toBe(enableMessage("subscribe_failed"))
  })
})

describe("sameApplicationServerKey", () => {
  const wanted = new Uint8Array([4, 1, 2, 3])
  it("tells a subscription made with the current key from one made with an older key", () => {
    expect(sameApplicationServerKey(new Uint8Array([4, 1, 2, 3]).buffer, wanted)).toBe(true)
    expect(sameApplicationServerKey(new Uint8Array([4, 9, 2, 3]).buffer, wanted)).toBe(false)
    expect(sameApplicationServerKey(new Uint8Array([4, 1, 2]).buffer, wanted)).toBe(false)
    expect(sameApplicationServerKey(null, wanted)).toBe(false)
  })
})

describe("withTimeout", () => {
  it("resolves in time, and rejects with the given name when it takes too long", async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7)
    await expect(withTimeout(new Promise(() => undefined), 10, "ReadyTimeout")).rejects.toMatchObject({ name: "ReadyTimeout" })
  })
})

describe("testToast", () => {
  it("says Teste enviado only when the push service accepted it for at least one device", () => {
    expect(testToast({ ok: true, sent: 1 })).toMatchObject({ kind: "success", text: expect.stringMatching(/^Teste enviado/) })
    expect(testToast({ ok: true, sent: 0 }).kind).toBe("error")
    expect(testToast({ ok: false, error: "O serviço de push recusou." })).toEqual({ kind: "error", text: "O serviço de push recusou." })
  })
})
