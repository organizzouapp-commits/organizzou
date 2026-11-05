/**
 * The post-login splash as an explicit state machine, so leaving it never depends on probing the page (selectors, skeletons, pathnames):
 *
 *   idle --pending--> pending --ready--> ready --dismissed--> dismissed
 *
 * `pending` is signalled by the login code before it navigates (or by the server-rendered splash of a resumed document), `ready` by the
 * dashboard shell when it mounts, `dismissed` once the overlay has faded out. `splashDue` says what the overlay should do right now: keep
 * waiting, leave (ready and the minimum display time is over), or give up (the hard limit, which shows whatever page is there).
 */
export type SplashPhase = "idle" | "pending" | "ready" | "dismissed"
export type SplashState = { phase: SplashPhase; pendingAt: number | null }
export type SplashEvent = "pending" | "ready" | "dismissed" | "reset"

export const SPLASH_IDLE: SplashState = { phase: "idle", pendingAt: null }

export function splashReduce(state: SplashState, event: SplashEvent, now: number): SplashState {
  switch (event) {
    case "pending":
      // A new login always starts over, whatever came before.
      return { phase: "pending", pendingAt: now }
    case "ready":
      // The shell can mount before anyone started waiting (a resumed document): only a pending splash becomes ready.
      return state.phase === "pending" ? { ...state, phase: "ready" } : state
    case "dismissed":
      return state.phase === "idle" ? state : { phase: "dismissed", pendingAt: state.pendingAt }
    case "reset":
      return SPLASH_IDLE
  }
}

export type SplashDue = "idle" | "wait" | "dismiss" | "timeout"

/** What to do now. `minMs`: the logo's intro (or its short reduced-motion time); `maxMs`: the hard limit, counted from `pending`. */
export function splashDue(state: SplashState, now: number, { minMs, maxMs }: { minMs: number; maxMs: number }): SplashDue {
  if (state.phase === "idle" || state.phase === "dismissed" || state.pendingAt === null) return "idle"
  const elapsed = now - state.pendingAt
  if (elapsed >= maxMs) return "timeout"
  if (state.phase === "ready" && elapsed >= minMs) return "dismiss"
  return "wait"
}

/** Safety net: still not on the target path this long after the client navigation started -> navigate for real. */
export function shouldHardNavigate(now: number, navigatedAt: number | null, pathname: string, target: string, afterMs = 3000) {
  return navigatedAt !== null && now - navigatedAt >= afterMs && pathname !== target && !pathname.startsWith(`${target}/`)
}

/** The hard limit, from the moment the overlay was shown: after it the page that is there is shown, whatever it is doing. */
export const SPLASH_MAX_MS = 6000
/** On the target path this long without the shell mounted (or with it mounted but no signal) -> act (reload / leave). */
export const SPLASH_ON_TARGET_MS = 1500
/** On the target path this long with NO shell: a layout that streams in 1-2 s is normal, so only then is it stuck -> one reload (what F5 does). */
export const SPLASH_RELOAD_MS = 3000

export type SplashStepInput = {
  state: SplashState
  now: number
  minMs: number
  maxMs?: number
  /** A dashboard shell is mounted right now (it unmounts when it goes away, so this is never stale). */
  shellMounted: boolean
  /** When the pathname first became the target path (null while it is not). */
  onTargetSince: number | null
  /** When the client navigation was started (null when there is none: a resumed document, or Google). */
  navigatedAt: number | null
  /** A full page load was already triggered by this splash. */
  reloaded: boolean
}
export type SplashStep = "idle" | "wait" | "dismiss" | "timeout" | "reload"

/**
 * The single decision of the splash, order-independent (the shell may have mounted before or after the login said "pending"):
 *  1. nothing pending -> idle; 2. the hard limit -> timeout (always leaves); 3. ready and the intro is over -> dismiss;
 *  4. on the target path for 1.5 s with the shell there -> dismiss; for 3 s with no shell -> one reload (what F5 does); 5. the client navigation went nowhere
 *  for 3 s -> one reload; 6. wait.
 */
export function splashStep(i: SplashStepInput): SplashStep {
  const { state, now } = i
  if (state.phase === "idle" || state.phase === "dismissed" || state.pendingAt === null) return "idle"
  const elapsed = now - state.pendingAt
  if (elapsed >= (i.maxMs ?? SPLASH_MAX_MS)) return "timeout"
  const introOver = elapsed >= i.minMs
  if (state.phase === "ready" && introOver) return "dismiss"
  if (i.onTargetSince !== null && now - i.onTargetSince >= SPLASH_ON_TARGET_MS) {
    if (i.shellMounted) return introOver ? "dismiss" : "wait"
  }
  if (i.onTargetSince !== null && !i.shellMounted && !i.reloaded && now - i.onTargetSince >= SPLASH_RELOAD_MS) return "reload"
  if (i.navigatedAt !== null && i.onTargetSince === null && !i.reloaded && now - i.navigatedAt >= 3000) return "reload"
  return "wait"
}
