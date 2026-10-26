/**
 * Cookie consent state (LGPD). Framework-free: no imports from the app, so this folder can be copied
 * into the marketing site as is. The choice lives in one first-party cookie shared by every subdomain
 * when NEXT_PUBLIC_COOKIE_DOMAIN is set (e.g. ".organizzou.com.br").
 */

/** Bump to ask everyone again (for example when the privacy policy changes). */
export const CONSENT_VERSION = 1

export const CONSENT_COOKIE = "organizzou_consent"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export type ConsentCategory = "necessary" | "analytics" | "marketing"

export type Consent = {
  version: number
  necessary: true
  analytics: boolean
  marketing: boolean
  /** ISO timestamp of the decision. */
  decidedAt: string
}

export type ConsentChoice = { analytics: boolean; marketing: boolean }

const CHANGE_EVENT = "organizzou:consent-change"
export const OPEN_PREFERENCES_EVENT = "organizzou:cookie-preferences"

function parse(raw: string | undefined): Consent | null {
  if (!raw) return null
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>
    if (value.version !== CONSENT_VERSION) return null
    return {
      version: value.version,
      necessary: true,
      analytics: value.analytics === true,
      marketing: value.marketing === true,
      decidedAt: typeof value.decidedAt === "string" ? value.decidedAt : "",
    }
  } catch {
    return null
  }
}

function rawCookie(): string {
  if (typeof document === "undefined") return ""
  const prefix = `${CONSENT_COOKIE}=`
  const found = document.cookie.split("; ").find((part) => part.startsWith(prefix))
  return found ? found.slice(prefix.length) : ""
}

/** The stored decision, or null when there is none (or it is for an older policy version). */
export function readConsent(): Consent | null {
  return parse(rawCookie())
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true
  return readConsent()?.[category] === true
}

export function saveConsent(choice: ConsentChoice): Consent {
  const consent: Consent = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    decidedAt: new Date().toISOString(),
  }
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN
  const parts = [
    `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ]
  if (domain) parts.push(`Domain=${domain}`)
  if (process.env.NODE_ENV === "production" || window.location.protocol === "https:") parts.push("Secure")
  document.cookie = parts.join("; ")
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return consent
}

export const acceptAll = () => saveConsent({ analytics: true, marketing: true })
export const rejectOptional = () => saveConsent({ analytics: false, marketing: false })

/** For useSyncExternalStore. The snapshot is the raw cookie string, so it is stable between reads. */
export function subscribeConsent(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

export const consentSnapshot = rawCookie
export const parseConsentSnapshot = parse

/** Reopens the preferences dialog from anywhere (for example a "Preferências de cookies" button). */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))
}
