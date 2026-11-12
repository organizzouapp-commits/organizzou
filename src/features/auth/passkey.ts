// Passkeys (WebAuthn), the parts that need no browser and no server: where the site lives (relying party id and origins), how a challenge ages,
// and the bytes/text conversions. Pure, so the defaults are tested.

export const CHALLENGE_TTL_MS = 5 * 60 * 1000
export const CHALLENGE_COOKIE = "org_wa_challenge"
export const RP_NAME = "Organizzou"

export type WebauthnConfig = { rpID: string; origins: string[] }

/**
 * The relying party id and the allowed origins. WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN (comma separated for more than one) win; otherwise
 * production defaults to organizzou.vercel.app and development to localhost. A passkey only works on the id it was created for.
 */
export function webauthnConfig(env: { WEBAUTHN_RP_ID?: string; WEBAUTHN_ORIGIN?: string; NODE_ENV?: string }): WebauthnConfig {
  const production = env.NODE_ENV === "production"
  const rpID = env.WEBAUTHN_RP_ID?.trim() || (production ? "organizzou.vercel.app" : "localhost")
  const fromEnv = (env.WEBAUTHN_ORIGIN ?? "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean)
  const origins = fromEnv.length > 0 ? fromEnv : production ? [`https://${rpID}`] : ["http://localhost:3000", "http://localhost:3100"]
  return { rpID, origins }
}

/** True while a stored challenge can still be used. */
export const challengeAlive = (row: { expires_at: string; consumed_at: string | null } | null, now: number): boolean => Boolean(row && !row.consumed_at && Date.parse(row.expires_at) > now)

export const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url")
export const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const buffer = Buffer.from(text, "base64url")
  const out = new Uint8Array(new ArrayBuffer(buffer.length))
  out.set(buffer)
  return out
}

/** The user handle the authenticator stores: the account id as bytes (opaque, never an e-mail). */
export const userHandle = (userId: string): Uint8Array<ArrayBuffer> => {
  const bytes = new TextEncoder().encode(userId)
  const out = new Uint8Array(new ArrayBuffer(bytes.length))
  out.set(bytes)
  return out
}

/** "iPhone de Patrick" for the first passkey of a phone; the person can rename it later. */
export function defaultPasskeyName(device: string, firstName: string): string {
  const base = device.replace(/^.* no /, "")
  const name = firstName.trim().split(/\s+/)[0]
  return (name ? `${base} de ${name}` : base || "Passkey").slice(0, 80)
}
