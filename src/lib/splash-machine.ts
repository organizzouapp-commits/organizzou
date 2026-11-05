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
