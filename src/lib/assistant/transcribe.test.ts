import { describe, expect, it, vi } from "vitest"

import { joinDictation } from "@/hooks/use-dictation"

import { assemble, createWebSpeechTranscriber, dictationMessage, explainNotAllowed, mapMediaError, mapRecognitionError, micPermissionState, policyBlocksMicrophone, requestMicrophone, UNSUPPORTED_MESSAGE, type MicEnv } from "./transcribe"

class FakeRecognition {
  static last: FakeRecognition
  lang = ""
  interimResults = false
  continuous = false
  maxAlternatives = 0
  onresult: ((e: { results: unknown[] }) => void) | null = null
  onerror: ((e: { error?: string }) => void) | null = null
  onend: (() => void) | null = null
  started = 0
  stopped = 0
  aborted = 0
  constructor() {
    FakeRecognition.last = this
  }
  start() {
    this.started++
  }
  stop() {
    this.stopped++
    this.onend?.()
  }
  abort() {
    this.aborted++
    this.onerror?.({ error: "aborted" })
    this.onend?.()
  }
}
const result = (transcript: string, isFinal: boolean) => Object.assign([{ transcript }], { isFinal })
const win = { webkitSpeechRecognition: FakeRecognition as never }
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A microphone that grants the permission, and counts how it was used. */
const grantingEnv = () => {
  const stop = vi.fn()
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }))
  const env: MicEnv = { mediaDevices: { getUserMedia }, permissions: { query: async () => ({ state: "granted" }) }, policy: null }
  return { env, getUserMedia, stop }
}

describe("web speech transcriber", () => {
  it("asks for the microphone first (this is what shows the real permission prompt), releases it, and only then listens in pt-BR", async () => {
    const { env, getUserMedia, stop } = grantingEnv()
    const t = createWebSpeechTranscriber(win, () => env)
    expect(t.supported).toBe(true)
    t.start({ onText: vi.fn(), onError: vi.fn(), onEnd: vi.fn() })
    // The request goes out in the same tick as the tap (a user gesture), the recognition has not started yet.
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(FakeRecognition.last?.started ?? 0).toBe(0)
    await tick()
    expect(stop).toHaveBeenCalledTimes(1)
    expect(FakeRecognition.last).toMatchObject({ lang: "pt-BR", interimResults: true, started: 1 })
  })
  it("shows interim text live and keeps the final text on stop", async () => {
    const t = createWebSpeechTranscriber(win, () => grantingEnv().env)
    const onText = vi.fn()
    const onEnd = vi.fn()
    t.start({ onText, onError: vi.fn(), onEnd })
    await tick()
    FakeRecognition.last.onresult?.({ results: [result("gastei quarenta", false)] })
    FakeRecognition.last.onresult?.({ results: [result("gastei quarenta e cinco no mercado", true)] })
    t.stop()
    expect(onText.mock.calls.map((c) => c[0])).toEqual(["gastei quarenta", "gastei quarenta e cinco no mercado"])
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
  it("cancel discards: no text after it and no error shown for the abort we asked for", async () => {
    const t = createWebSpeechTranscriber(win, () => grantingEnv().env)
    const onText = vi.fn()
    const onError = vi.fn()
    t.start({ onText, onError, onEnd: vi.fn() })
    await tick()
    t.cancel()
    FakeRecognition.last.onresult?.({ results: [result("depois do cancelar", true)] })
    expect(onText).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(FakeRecognition.last.aborted).toBe(1)
  })
  it("a tap cancelled while the permission prompt is open never starts listening", async () => {
    const { env } = grantingEnv()
    const before = FakeRecognition.last
    const t = createWebSpeechTranscriber(win, () => env)
    const onEnd = vi.fn()
    t.start({ onText: vi.fn(), onError: vi.fn(), onEnd })
    t.cancel()
    await tick()
    expect(FakeRecognition.last).toBe(before)
    expect(onEnd).toHaveBeenCalled()
  })
  it("(c) without SpeechRecognition (iOS home-screen app) it says so instead of failing silently", () => {
    const t = createWebSpeechTranscriber({}, () => ({}))
    const onError = vi.fn()
    const onEnd = vi.fn()
    expect(t.supported).toBe(false)
    t.start({ onText: vi.fn(), onError, onEnd })
    expect(onError).toHaveBeenCalledWith("unsupported")
    expect(onEnd).toHaveBeenCalled()
    expect(UNSUPPORTED_MESSAGE).toBe("Seu navegador não permite ditado por voz aqui. Use o microfone do teclado do celular.")
  })
})

describe("the permission step", () => {
  const rejecting = (name: string, state: string, policy: MicEnv["policy"] = null): MicEnv => ({
    mediaDevices: { getUserMedia: async () => Promise.reject({ name }) },
    permissions: { query: async () => ({ state }) },
    policy,
  })

  it("(a) the site's Permissions-Policy turns the microphone off: nothing is requested and the message says it is the site", async () => {
    const getUserMedia = vi.fn()
    const env: MicEnv = { mediaDevices: { getUserMedia }, policy: { allowsFeature: (f) => f !== "microphone" } }
    expect(policyBlocksMicrophone(env.policy)).toBe(true)
    expect(await requestMicrophone(env)).toEqual({ ok: false, error: "blocked-policy" })
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(dictationMessage("blocked-policy")).toMatch(/configuração do próprio site/)
  })
  it("(b) the person denied it: the message explains how to allow it again", async () => {
    expect(await requestMicrophone(rejecting("NotAllowedError", "denied"))).toEqual({ ok: false, error: "denied" })
    expect(dictationMessage("denied")).toMatch(/Permissões, escolha Microfone e Permitir/)
  })
  it("a closed prompt (still 'prompt') is not reported as a refusal", async () => {
    expect(await requestMicrophone(rejecting("NotAllowedError", "prompt"))).toEqual({ ok: false, error: "dismissed" })
  })
  it("no microphone, one in use, and unknown failures", async () => {
    expect(await requestMicrophone(rejecting("NotFoundError", "prompt"))).toEqual({ ok: false, error: "no-mic" })
    expect(await requestMicrophone(rejecting("NotReadableError", "granted"))).toEqual({ ok: false, error: "mic-busy" })
    expect(await requestMicrophone(rejecting("Whatever", "granted"))).toEqual({ ok: false, error: "unknown" })
  })
  it("a browser that cannot query the permission still works, and one with no getUserMedia leaves the decision to the recognition", async () => {
    expect(await micPermissionState({})).toBe("unknown")
    expect(await micPermissionState({ permissions: { query: async () => Promise.reject(new TypeError("bad name")) } })).toBe("unknown")
    expect(await requestMicrophone({})).toEqual({ ok: true })
  })
  it("a refusal by the recognition itself is explained the same way (policy first, else the person's choice)", () => {
    expect(explainNotAllowed(true, "denied")).toBe("blocked-policy")
    expect(explainNotAllowed(false, "denied")).toBe("denied")
    expect(explainNotAllowed(false, "unknown")).toBe("denied")
    expect(mapMediaError("SecurityError", true, "unknown")).toBe("blocked-policy")
  })
  it("when the recognition says not-allowed after a granted permission, the person's choice is reported and the permission is asked again next time", async () => {
    const { env, getUserMedia } = grantingEnv()
    const t = createWebSpeechTranscriber(win, () => env)
    const onError = vi.fn()
    t.start({ onText: vi.fn(), onError, onEnd: vi.fn() })
    await tick()
    FakeRecognition.last.onerror?.({ error: "not-allowed" })
    expect(onError).toHaveBeenCalledWith("denied")
    t.start({ onText: vi.fn(), onError: vi.fn(), onEnd: vi.fn() })
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })
})

describe("errors and text", () => {
  it("maps the browser's codes and explains each one in pt-BR", () => {
    expect(mapRecognitionError("not-allowed")).toBe("denied")
    expect(mapRecognitionError("service-not-allowed")).toBe("denied")
    expect(mapRecognitionError("no-speech")).toBe("no-speech")
    expect(mapRecognitionError("network")).toBe("network")
    expect(mapRecognitionError("aborted")).toBe("aborted")
    expect(mapRecognitionError("audio-capture")).toBe("no-mic")
    expect(mapRecognitionError("???")).toBe("unknown")
    expect(dictationMessage("no-speech")).toMatch(/Não ouvi nada/)
    expect(dictationMessage("network")).toMatch(/internet/)
  })
  it("assembles results and joins them to what was typed before", () => {
    expect(assemble([result("oi", true), result("tudo bem", false)])).toBe("oi tudo bem")
    expect(joinDictation("", "oi")).toBe("oi")
    expect(joinDictation("anota", "comprar leite")).toBe("anota comprar leite")
    expect(joinDictation("anota ", "")).toBe("anota")
  })
})
