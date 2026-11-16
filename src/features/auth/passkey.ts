// Passkeys (WebAuthn), the parts that need no browser and no server: where the site lives (relying party id and origins), how a challenge ages,
// and the bytes/text conversions. Pure, so the defaults are tested.

export const CHALLENGE_TTL_MS = 5 * 60 * 1000
export const CHALLENGE_COOKIE = "org_wa_challenge"
export const RP_NAME = "Organizzou"

import { hostOf, PRODUCTION_SITE_URL } from "@/lib/site-url"

export type WebauthnConfig = { rpID: string; origins: string[] }

/**
 * The relying party id and the allowed origins. WEBAUTHN_RP_ID (one value) and WEBAUTHN_ORIGIN (comma separated, any number) win; otherwise
 * production defaults to organizzou.com / https://organizzou.com and development to localhost.
 *
 * A passkey only works on the id it was created for. Passkeys registered while the id was organizzou.vercel.app do NOT work on organizzou.com:
 * they must be registered again (Configurações > Segurança). The id stays a single value; the origins may list several sites that sit under
 * it, e.g. WEBAUTHN_ORIGIN=https://organizzou.com,https://www.organizzou.com (add https://organizzou.vercel.app only while the old id is kept).
 */
export function webauthnConfig(env: { WEBAUTHN_RP_ID?: string; WEBAUTHN_ORIGIN?: string; NODE_ENV?: string }): WebauthnConfig {
  const production = env.NODE_ENV === "production"
  const rpID = env.WEBAUTHN_RP_ID?.trim() || (production ? hostOf(PRODUCTION_SITE_URL) : "localhost")
  const fromEnv = (env.WEBAUTHN_ORIGIN ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)
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

// ---------------------------------------------------------------- sign-in failures
// One reason code per place a passkey sign-in can fail. The code goes to the server log (never a challenge, key, token or credential id) and to
// the browser (so the screen can say something precise); the browser never learns more than the code.

export type PasskeyFailReason =
  | "not_configured"
  | "bad_config"
  | "bad_request"
  | "challenge_missing"
  | "challenge_expired"
  | "challenge_used"
  | "challenge_mismatch"
  | "credential_not_found"
  | "user_handle_mismatch"
  | "origin_mismatch"
  | "rpid_mismatch"
  | "challenge_wrong"
  | "user_not_verified"
  | "counter"
  | "verify_failed"
  | "user_not_found"
  | "link_failed"
  | "session_failed"

const GENERIC = "Não consegui entrar com a passkey. Tente de novo ou use sua senha."

/** What the login screen says for each reason (pt-BR). Unknown or missing reasons get the generic sentence. */
export function passkeyFailMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "challenge_missing":
    case "challenge_expired":
    case "challenge_used":
    case "challenge_mismatch":
    case "challenge_wrong":
      return "A confirmação expirou. Tente de novo."
    case "credential_not_found":
    case "user_handle_mismatch":
      return "Essa passkey não está cadastrada neste site. Entre com a senha e cadastre uma nova em Configurações."
    case "origin_mismatch":
    case "rpid_mismatch":
      return "Essa passkey foi criada para outro endereço do site e não funciona aqui. Entre com a senha."
    case "user_not_verified":
      return "O aparelho não confirmou que é você (biometria ou PIN). Tente de novo."
    case "counter":
      return "Essa passkey foi recusada por segurança (parece uma cópia). Entre com a senha e cadastre uma nova."
    case "link_failed":
    case "session_failed":
    case "user_not_found":
      return "Confirmei a passkey, mas não consegui abrir sua sessão. Tente de novo ou use sua senha."
    case "bad_config":
      return "As passkeys estão com a configuração do site incorreta no servidor. Entre com a senha."
    case "not_configured":
      return "As passkeys ainda não estão disponíveis neste servidor."
    default:
      return GENERIC
  }
}

export type ChallengeRow = { purpose: string; user_id: string | null; expires_at: string; consumed_at: string | null }

/** Why a stored challenge cannot be used (or null when it can): the cookie points at no row, the wrong ceremony or person, a used one, an old one. */
export function challengeProblem(row: ChallengeRow | null, purpose: string, userId: string | null, now: number): PasskeyFailReason | null {
  if (!row) return "challenge_missing"
  if (row.purpose !== purpose || row.user_id !== userId) return "challenge_mismatch"
  if (row.consumed_at) return "challenge_used"
  if (!(Date.parse(row.expires_at) > now)) return "challenge_expired"
  return null
}
