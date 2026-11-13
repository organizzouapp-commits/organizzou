// "Strong authentication" proof for the current session: a signed cookie that says "this person passed the second step (an e-mail code or a
// passkey) in THIS session". The server (proxy) trusts only this signature, never a flag the browser could send. Web Crypto, so it runs in the
// proxy and in server actions alike. The cookie is httpOnly, secure in production and sameSite=lax; it is bound to the user id and to the
// Supabase session id, so a cookie from another session or person is useless.

export const STRONG_COOKIE = "org_2fa"
export const STRONG_TTL_SECONDS = 14 * 24 * 60 * 60

const encoder = new TextEncoder()

async function key(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage)
}

const toHex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("")
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => Number.parseInt(h, 16)))

const message = (userId: string, sessionId: string, expiresAt: number) => encoder.encode(`strong:v1:${userId}:${sessionId}:${expiresAt}`)

/** The cookie value: "<expires>.<hmac>". */
export async function signStrongProof(secret: string, userId: string, sessionId: string, now = Date.now(), ttlSeconds = STRONG_TTL_SECONDS): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + ttlSeconds
  const signature = await crypto.subtle.sign("HMAC", await key(secret, ["sign"]), message(userId, sessionId, expiresAt))
  return `${expiresAt}.${toHex(signature)}`
}

/** True only for an unexpired value signed for exactly this user and session. The comparison is constant-time (subtle.verify). */
export async function verifyStrongProof(secret: string | null, value: string | undefined, userId: string, sessionId: string, now = Date.now()): Promise<boolean> {
  if (!secret || !value) return false
  const [expires, signature] = value.split(".")
  const expiresAt = Number(expires)
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= now || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false
  return crypto.subtle.verify("HMAC", await key(secret, ["verify"]), fromHex(signature), message(userId, sessionId, expiresAt))
}

/** The secret that signs the proof: AUTH_COOKIE_SECRET (any long random string). Null when it is not set: the second step then cannot be turned on. */
export function strongSecret(): string | null {
  const value = process.env.AUTH_COOKIE_SECRET
  return value && value.length >= 32 ? value : null
}

/** Whether a JWT's claims say this person turned the second step on (set only by the server, in app_metadata). */
export function requiresSecondStep(claims: { app_metadata?: unknown } | null | undefined): boolean {
  const meta = claims?.app_metadata
  return Boolean(meta && typeof meta === "object" && (meta as { two_factor?: unknown }).two_factor === true)
}

export const strongCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: STRONG_TTL_SECONDS }
