/**
 * Voice input for the assistant, behind a small interface so the engine can change without touching the screen.
 *
 * PRIVACY: this default implementation uses the browser's own speech recognition (Web Speech API). The browser handles the audio.
 * NO audio is recorded by Organizzou, stored, or sent to our server; only the final text lands in the message box, and it is sent like
 * any typed message, after the person reviews it. Recognition starts only when the person taps the microphone (that is also the only moment
 * the browser asks for the microphone permission).
 *
 * LATER: a server transcriber (env var NAMES only, not implemented: TRANSCRIBE_PROVIDER, TRANSCRIBE_API_KEY) can be added as another
 * `Transcriber` returned by `createTranscriber`, with no change to the UI: the screen only talks to `Transcriber`.
 */

export type DictationError = "denied" | "no-mic" | "no-speech" | "network" | "aborted" | "unsupported" | "unknown"

export type TranscriberHandlers = {
  /** Everything heard so far in this session: the final parts plus the interim guess, as one text. */
  onText: (text: string) => void
  onError: (error: DictationError) => void
  /** Always called once when the session is over (after a stop, a cancel or an error). */
  onEnd: () => void
}

export type Transcriber = {
  /** False when this browser cannot do it (for example an iOS home-screen app). */
  readonly supported: boolean
  start(handlers: TranscriberHandlers): void
  /** Finish: what was heard so far is kept. */
  stop(): void
  /** Throw it away: nothing more is reported through `onText`. */
  cancel(): void
}

export const UNSUPPORTED_MESSAGE = "Seu navegador não permite ditado por voz aqui. Use o microfone do teclado do celular."

const MESSAGES: Record<DictationError, string> = {
  unsupported: UNSUPPORTED_MESSAGE,
  denied: "O microfone está bloqueado. Toque no cadeado ao lado do endereço do site, permita o microfone e tente de novo. No celular, confira também as permissões do navegador nas configurações.",
  "no-mic": "Não encontrei um microfone neste aparelho. Conecte um ou use o microfone do teclado.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale de novo, perto do aparelho.",
  network: "O reconhecimento de voz precisa de internet e não conseguiu conectar. Tente de novo em instantes.",
  aborted: "",
  unknown: "Não consegui ouvir agora. Tente de novo ou use o microfone do teclado.",
}

export const dictationMessage = (error: DictationError) => MESSAGES[error]

/** Maps the browser's SpeechRecognition error code to ours. */
export function mapRecognitionError(code: string | undefined): DictationError {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied"
    case "audio-capture":
      return "no-mic"
    case "no-speech":
      return "no-speech"
    case "network":
      return "network"
    case "aborted":
      return "aborted"
    default:
      return "unknown"
  }
}

/** Text of a recognition result list: finals first-come, then the interim guess. */
export function assemble(results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>): string {
  let text = ""
  for (let i = 0; i < results.length; i++) text += `${results[i][0]?.transcript ?? ""} `
  return text.replace(/\s+/g, " ").trim()
}

type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type Ctor = new () => Recognition
type Win = { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }

const noop = () => undefined

/** The default transcriber: the browser's Web Speech API in pt-BR with interim results. `win` is injectable for tests. */
export function createWebSpeechTranscriber(win: Win | null = typeof window === "undefined" ? null : (window as unknown as Win)): Transcriber {
  const Recognizer = win?.SpeechRecognition ?? win?.webkitSpeechRecognition ?? null
  let current: Recognition | null = null
  let cancelled = false
  return {
    supported: Recognizer !== null,
    start(handlers) {
      if (!Recognizer) {
        handlers.onError("unsupported")
        handlers.onEnd()
        return
      }
      cancelled = false
      const r = new Recognizer()
      r.lang = "pt-BR"
      r.interimResults = true
      r.continuous = false
      r.maxAlternatives = 1
      r.onresult = (event) => {
        if (!cancelled) handlers.onText(assemble(event.results))
      }
      r.onerror = (event) => {
        const error = mapRecognitionError(event.error)
        // An abort we asked for (cancel) is not an error to show.
        if (!(error === "aborted" && cancelled)) handlers.onError(error)
      }
      r.onend = () => {
        current = null
        handlers.onEnd()
      }
      current = r
      try {
        r.start()
      } catch {
        current = null
        handlers.onError("unknown")
        handlers.onEnd()
      }
    },
    stop() {
      try {
        current?.stop()
      } catch {
        noop()
      }
    },
    cancel() {
      cancelled = true
      try {
        current?.abort()
      } catch {
        noop()
      }
    },
  }
}

/** The transcriber the app uses. Only the browser one exists today. */
export const createTranscriber = (): Transcriber => createWebSpeechTranscriber()
