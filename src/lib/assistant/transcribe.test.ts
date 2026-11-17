import { describe, expect, it, vi } from "vitest"

import { joinDictation } from "@/hooks/use-dictation"

import { assemble, createWebSpeechTranscriber, dictationMessage, mapRecognitionError, UNSUPPORTED_MESSAGE } from "./transcribe"

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

describe("web speech transcriber", () => {
  it("listens in pt-BR with interim results, only after start() (that is when the browser asks for the microphone)", () => {
    const t = createWebSpeechTranscriber(win)
    expect(t.supported).toBe(true)
    expect(FakeRecognition.last).toBeUndefined()
    t.start({ onText: vi.fn(), onError: vi.fn(), onEnd: vi.fn() })
    expect(FakeRecognition.last).toMatchObject({ lang: "pt-BR", interimResults: true, started: 1 })
  })
  it("shows interim text live and keeps the final text on stop", () => {
    const t = createWebSpeechTranscriber(win)
    const onText = vi.fn()
    const onEnd = vi.fn()
    t.start({ onText, onError: vi.fn(), onEnd })
    FakeRecognition.last.onresult?.({ results: [result("gastei quarenta", false)] })
    FakeRecognition.last.onresult?.({ results: [result("gastei quarenta e cinco no mercado", true)] })
    t.stop()
    expect(onText.mock.calls.map((c) => c[0])).toEqual(["gastei quarenta", "gastei quarenta e cinco no mercado"])
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
  it("cancel discards: no text after it and no error shown for the abort we asked for", () => {
    const t = createWebSpeechTranscriber(win)
    const onText = vi.fn()
    const onError = vi.fn()
    t.start({ onText, onError, onEnd: vi.fn() })
    t.cancel()
    FakeRecognition.last.onresult?.({ results: [result("depois do cancelar", true)] })
    expect(onText).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(FakeRecognition.last.aborted).toBe(1)
  })
  it("without SpeechRecognition (iOS home-screen app) it says so instead of failing silently", () => {
    const t = createWebSpeechTranscriber({})
    const onError = vi.fn()
    const onEnd = vi.fn()
    expect(t.supported).toBe(false)
    t.start({ onText: vi.fn(), onError, onEnd })
    expect(onError).toHaveBeenCalledWith("unsupported")
    expect(onEnd).toHaveBeenCalled()
    expect(UNSUPPORTED_MESSAGE).toBe("Seu navegador não permite ditado por voz aqui. Use o microfone do teclado do celular.")
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
    expect(dictationMessage("denied")).toMatch(/permita o microfone/)
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
