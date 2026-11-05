/**
 * The post-login splash survives FULL page loads (Google sign-in leaves the app and comes back through /auth/callback), so what a new
 * document does with it is decided from two timestamps in short-lived cookies, never from in-memory state:
 *   org_splash      the moment the login started (written before leaving for Google)
 *   org_splash_ret  the moment the callback sent the person back (written by /auth/callback)
 * This function is PURE and self-contained: it is also stringified into the inline boot script that runs before the first paint, so it must not
 * use anything from outside its own body.
 */
export function splashResume(now: number, start: number | null, ret: number | null, introMs = 2600, windowMs = 20000): { show: boolean; elapsed: number; final: boolean } {
  const valid = (t: number | null): t is number => typeof t === "number" && isFinite(t) && t > 0 && t <= now + 1000
  // Counted from the return when there is one (the person may have spent a minute on Google's page), else from the start.
  const anchor = valid(ret) ? ret : valid(start) ? start : null
  if (anchor === null || now - anchor > windowMs) return { show: false, elapsed: 0, final: false }
  // Time already spent animating: from the start of the login, so the intro is never played twice. Clamped to the intro length.
  const sinceStart = valid(start) ? Math.max(0, now - start) : Math.max(0, now - anchor)
  const elapsed = Math.min(sinceStart, introMs)
  return { show: true, elapsed, final: sinceStart >= introMs }
}
