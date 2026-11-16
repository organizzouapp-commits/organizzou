// The "Instalar app" experience, apart from the browser: which install path a device has, and when the banner may show. Pure.

export type InstallPlatform = "prompt" | "ios" | "other"

/** iPhone and iPad (Safari has no install prompt: the person adds the app by hand); everything else uses the install event when it fires. */
export const isIosDevice = (userAgent: string, maxTouchPoints = 0): boolean => /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)

export function installPlatform(facts: { userAgent: string; maxTouchPoints?: number; hasPromptEvent: boolean }): InstallPlatform {
  if (facts.hasPromptEvent) return "prompt"
  return isIosDevice(facts.userAgent, facts.maxTouchPoints) ? "ios" : "other"
}

export const DISMISS_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export type BannerFacts = {
  /** How many separate visits (sessions) the person has made, this one included. */
  visits: number
  /** When the banner was dismissed (ms since epoch), or null. */
  dismissedAt: number | null
  standalone: boolean
  platform: InstallPlatform
  now: number
}

/** The banner shows from the second visit, only where an install is possible, never when the app is already installed, and rests for 30 days after "Agora não". */
export function shouldShowInstallBanner(facts: BannerFacts): boolean {
  if (facts.standalone || facts.platform === "other") return false
  if (facts.visits < 2) return false
  if (facts.dismissedAt !== null && facts.now - facts.dismissedAt < DISMISS_DAYS * DAY_MS) return false
  return true
}

/** A visit counts once per browser session (so reloading never inflates it). */
export function nextVisitCount(stored: number, alreadyCountedThisSession: boolean): number {
  return alreadyCountedThisSession ? stored : stored + 1
}
