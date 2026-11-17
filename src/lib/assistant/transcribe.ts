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

export type DictationError = "denied" | "blocked-policy" | "dismissed" | "no-mic" | "mic-busy" | "no-speech" | "network" | "aborted" | "unsupported" | "unknown"

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
  // (b) the person said no (or the browser remembers a no): they can undo it.
  denied: "Você bloqueou o microfone para o Organizzou. Toque no cadeado ao lado do endereço, abra Permissões, escolha Microfone e Permitir, e tente de novo. No app instalado: Configurações do Android > Apps > Chrome > Permissões > Microfone.",
  // (a) the SITE turned it off (a Permissions-Policy header): nothing the person can change on their side.
  "blocked-policy": "O microfone está desligado pela configuração do próprio site, não por você. Avise o suporte do Organizzou. Enquanto isso, use o microfone do teclado do celular.",
  dismissed: "O pedido de permissão foi fechado. Toque no microfone de novo e escolha Permitir.",
  "mic-busy": "O microfone está em uso por outro app. Feche o outro app e tente de novo.",
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

// ---- the microphone permission ------------------------------------------------------------------------------------------------------

type PermissionStateName = "granted" | "denied" | "prompt" | "unknown"
export type MicEnv = {
  mediaDevices?: { getUserMedia?: (constraints: { audio: boolean }) => Promise<{ getTracks: () => { stop: () => void }[] }> }
  permissions?: { query?: (descriptor: { name: string }) => Promise<{ state: string }> }
  /** document.permissionsPolicy (or the older featurePolicy): tells whether the page may use the microphone at all. */
  policy?: { allowsFeature?: (feature: string) => boolean } | null
}

/** (a) True when the page's Permissions-Policy turns the microphone off. Unknown (no API) counts as allowed. */
export function policyBlocksMicrophone(policy: MicEnv["policy"]): boolean {
  try {
    return policy?.allowsFeature ? policy.allowsFeature("microphone") === false : false
  } catch {
    return false
  }
}

/** The permission state, when the browser can say. Never throws (the "microphone" name is not known to every browser). */
export async function micPermissionState(env: MicEnv): Promise<PermissionStateName> {
  try {
    const result = await env.permissions?.query?.({ name: "microphone" })
    return result?.state === "granted" || result?.state === "denied" || result?.state === "prompt" ? result.state : "unknown"
  } catch {
    return "unknown"
  }
}

/** Which of our errors a failed getUserMedia / SpeechRecognition "not allowed" is: the site's policy, a no from the person, or a closed prompt. */
export function explainNotAllowed(policyBlocked: boolean, state: PermissionStateName): DictationError {
  if (policyBlocked) return "blocked-policy"
  if (state === "denied") return "denied"
  // Still "prompt" after a refusal: the person closed the prompt without choosing.
  if (state === "prompt") return "dismissed"
  return "denied"
}

/** Maps a getUserMedia rejection (a DOMException name) to our error. */
export function mapMediaError(name: string | undefined, policyBlocked: boolean, state: PermissionStateName): DictationError {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return explainNotAllowed(policyBlocked, state)
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-mic"
    case "NotReadableError":
    case "AbortError":
      return "mic-busy"
    default:
      return "unknown"
  }
}

/**
 * Asks the browser for the microphone ONCE, which is what makes the real permission prompt appear (and the "Microfone" entry show up in the
 * site settings), then releases it at once: no audio is read or kept. Called in the same tick as the tap, so it is still a user gesture.
 */
export function requestMicrophone(env: MicEnv): Promise<{ ok: true } | { ok: false; error: DictationError }> {
  const policyBlocked = policyBlocksMicrophone(env.policy)
  if (policyBlocked) return Promise.resolve({ ok: false, error: "blocked-policy" })
  const getUserMedia = env.mediaDevices?.getUserMedia?.bind(env.mediaDevices)
  // Without getUserMedia (an old or insecure page) the recognition itself decides.
  if (!getUserMedia) return Promise.resolve({ ok: true })
  // Both calls start in this same tick: the prompt, and the question of what state the permission is in.
  const asking = getUserMedia({ audio: true })
  const state = micPermissionState(env)
  return asking.then(
    (stream) => {
      stream.getTracks().forEach((track) => track.stop())
      return { ok: true as const }
    },
    async (error: { name?: string }) => ({ ok: false as const, error: mapMediaError(error?.name, policyBlocked, await state) })
  )
}

/** The browser environment, read lazily so importing this file on the server is safe. */
function browserEnv(): MicEnv {
  if (typeof navigator === "undefined") return {}
  const doc = typeof document === "undefined" ? null : (document as unknown as { permissionsPolicy?: MicEnv["policy"]; featurePolicy?: MicEnv["policy"] })
  return { mediaDevices: navigator.mediaDevices as MicEnv["mediaDevices"], permissions: navigator.permissions as MicEnv["permissions"], policy: doc?.permissionsPolicy ?? doc?.featurePolicy ?? null }
}

/** The default transcriber: the browser's Web Speech API in pt-BR with interim results. `win` is injectable for tests. */
export function createWebSpeechTranscriber(win: Win | null = typeof window === "undefined" ? null : (window as unknown as Win), env: () => MicEnv = browserEnv): Transcriber {
  const Recognizer = win?.SpeechRecognition ?? win?.webkitSpeechRecognition ?? null
  let current: Recognition | null = null
  let cancelled = false
  let micReady = false
  return {
    supported: Recognizer !== null,
    start(handlers) {
      if (!Recognizer) {
        handlers.onError("unsupported")
        handlers.onEnd()
        return
      }
      cancelled = false
      const begin = () => {
        if (cancelled) return handlers.onEnd()
        run(Recognizer, handlers)
      }
      // The tap is still the current event here: the permission request goes out now, and the recognition starts as soon as it is granted.
      if (micReady) return begin()
      void requestMicrophone(env()).then((result) => {
        if (result.ok) {
          micReady = true
          return begin()
        }
        if (!cancelled) handlers.onError(result.error)
        handlers.onEnd()
      })
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

  function run(Recognizer: Ctor, handlers: TranscriberHandlers) {
    {
      const r = new Recognizer()
      r.lang = "pt-BR"
      r.interimResults = true
      r.continuous = false
      r.maxAlternatives = 1
      r.onresult = (event) => {
        if (!cancelled) handlers.onText(assemble(event.results))
      }
      r.onerror = (event) => {
        let error = mapRecognitionError(event.error)
        // not-allowed after the permission step: say whether the site's policy or the person's choice is behind it.
        if (error === "denied") {
          micReady = false
          error = policyBlocksMicrophone(env().policy) ? "blocked-policy" : "denied"
        }
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
    }
  }
}

/** The transcriber the app uses. Only the browser one exists today. */
export const createTranscriber = (): Transcriber => createWebSpeechTranscriber()
