// VAPID configuration checks, pure apart from node:crypto. The keys are never returned or logged: only a reason code.
//
// Web push fails in confusing ways when the configuration is slightly off (a key pasted with a line break, a public key that does not belong to
// the private key, a subject that is a bare e-mail). Each of those has its own code here, so the server can say exactly what is wrong.
import { createECDH } from "node:crypto"

import { SUPPORT_EMAIL } from "@/lib/support"

export type VapidProblem = "missing_public" | "missing_private" | "public_invalid" | "private_invalid" | "keys_mismatch"

const BASE64URL = /^[A-Za-z0-9_-]+$/

/** Environment values often arrive with spaces, quotes or a trailing newline: the key itself never contains them. */
export const cleanKey = (value: string | undefined | null): string => (value ?? "").trim().replace(/^["']|["']$/g, "").trim()

const decode = (key: string): Buffer | null => (BASE64URL.test(key) ? Buffer.from(key, "base64url") : null)

/** What is wrong with the key pair (or null when it is usable). Checks the sizes and that the public key really belongs to the private key. */
export function vapidProblem(input: { publicKey: string | undefined; privateKey: string | undefined }): VapidProblem | null {
  const publicKey = cleanKey(input.publicKey)
  const privateKey = cleanKey(input.privateKey)
  if (!publicKey) return "missing_public"
  if (!privateKey) return "missing_private"
  const pub = decode(publicKey)
  // An uncompressed P-256 point: 65 bytes starting with 0x04. A private key: 32 bytes.
  if (!pub || pub.length !== 65 || pub[0] !== 0x04) return "public_invalid"
  const priv = decode(privateKey)
  if (!priv || priv.length !== 32) return "private_invalid"
  try {
    const ecdh = createECDH("prime256v1")
    ecdh.setPrivateKey(priv)
    return ecdh.getPublicKey().equals(pub) ? null : "keys_mismatch"
  } catch {
    return "private_invalid"
  }
}

export const VAPID_PROBLEM_MESSAGES: Record<VapidProblem, string> = {
  missing_public: "As notificações ainda não estão ligadas neste servidor: falta a chave pública (VAPID_PUBLIC_KEY).",
  missing_private: "As notificações ainda não estão ligadas neste servidor: falta a chave privada (VAPID_PRIVATE_KEY).",
  public_invalid: "A chave pública das notificações (VAPID_PUBLIC_KEY) está em formato inválido. Gere o par de novo e cole sem espaços nem quebras de linha.",
  private_invalid: "A chave privada das notificações (VAPID_PRIVATE_KEY) está em formato inválido. Gere o par de novo e cole sem espaços nem quebras de linha.",
  keys_mismatch: "A chave pública e a privada das notificações não são do mesmo par. Use as duas do mesmo comando de geração.",
}

/**
 * The VAPID subject must be mailto: or an https URL. A bare e-mail is fixed ("mailto:" added); anything else falls back to the support address
 * so a typo can never stop the sending (it is reported as `valid: false` for the log).
 */
export function normalizeSubject(raw: string | undefined | null): { subject: string; valid: boolean } {
  const fallback = `mailto:${SUPPORT_EMAIL}`
  const value = (raw ?? "").trim()
  if (!value) return { subject: fallback, valid: true }
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) return { subject: value, valid: true }
  if (/^[^\s@:]+@[^\s@]+\.[^\s@]+$/.test(value)) return { subject: `mailto:${value}`, valid: true }
  try {
    if (new URL(value).protocol === "https:") return { subject: value, valid: true }
  } catch {
    // not a URL
  }
  return { subject: fallback, valid: false }
}
