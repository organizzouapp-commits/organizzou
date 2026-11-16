import type { SupabaseClient } from "@supabase/supabase-js"
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server"
import { NextResponse, type NextRequest } from "next/server"

import { CHALLENGE_COOKIE, CHALLENGE_TTL_MS, challengeProblem, defaultPasskeyName, passkeyFailMessage, RP_NAME, toBase64Url, userHandle, webauthnConfig, type ChallengeRow, type PasskeyFailReason } from "@/features/auth/passkey"
import { verifyLoginAssertion } from "@/features/auth/passkey-verify"
import { deviceLabel } from "@/features/notifications/push"
import { createSecretClient, secretKeyConfigured } from "@/lib/admin/secret"
import { signStrongProof, STRONG_COOKIE, strongCookieOptions, strongSecret } from "@/lib/auth/strong-auth"
import { createLimiter } from "@/lib/rate-limit"
import { safeNextPath } from "@/lib/safe-next"
import { createClient } from "@/lib/supabase/server"

// Passkeys (WebAuthn). Registration needs a signed-in person; sign-in does not (that is the point). The challenge of each ceremony is random,
// stored server side, single use and short lived; the assertion is verified with the site's real origin and id before anything happens.
// After a verified sign-in the server asks Supabase for a one-time link for that account and redeems it itself, which gives a normal Supabase
// session (the same cookies as a password login). A passkey sign-in counts as strong authentication: the second-step proof is set too.

const limiter = createLimiter({ max: 30, windowMs: 60_000 })
const bad = (status = 400, error = "Não foi possível concluir. Tente de novo.") => NextResponse.json({ ok: false, error }, { status })

/** A failed sign-in: one structured log line with a reason code (never a challenge, key, token or credential id) and the same code for the screen. */
function loginFailed(reason: PasskeyFailReason, status = 401, detail = "") {
  console.warn(`[passkey] auth_failed reason=${reason}${detail ? ` ${detail}` : ""}`)
  return NextResponse.json({ ok: false, reason, error: passkeyFailMessage(reason) }, { status })
}
const config = () => webauthnConfig({ WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN, NODE_ENV: process.env.NODE_ENV })

type Db = SupabaseClient

async function storeChallenge(db: Db, purpose: "register" | "login", challenge: string, userId: string | null) {
  const { data, error } = await db.from("webauthn_challenges").insert({ purpose, challenge, user_id: userId, expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() }).select("id").single()
  if (error || !data) return null
  return (data as { id: string }).id
}

/** Takes the challenge the cookie points to, once: a second use (or another purpose, or another person) finds nothing. Says WHY when it cannot. */
async function takeChallenge(db: Db, request: NextRequest, purpose: "register" | "login", userId: string | null): Promise<{ challenge: string } | { reason: PasskeyFailReason }> {
  const id = request.cookies.get(CHALLENGE_COOKIE)?.value
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return { reason: "challenge_missing" }
  const { data } = await db.from("webauthn_challenges").select("challenge, user_id, purpose, expires_at, consumed_at").eq("id", id).maybeSingle()
  const row = data as (ChallengeRow & { challenge: string }) | null
  const problem = challengeProblem(row, purpose, userId, Date.now())
  if (problem || !row) return { reason: problem ?? "challenge_missing" }
  const used = await db.from("webauthn_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", id).is("consumed_at", null).select("id")
  return (used.data ?? []).length === 1 ? { challenge: row.challenge } : { reason: "challenge_used" }
}

function withChallengeCookie(response: NextResponse, id: string) {
  response.cookies.set(CHALLENGE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/passkey", maxAge: CHALLENGE_TTL_MS / 1000 })
  return response
}

const sessionIdOf = (accessToken: string): string => {
  try {
    return String((JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as { session_id?: unknown }).session_id ?? "")
  } catch {
    return ""
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  if (!limiter.hit(`${action}:${ip}`).ok) return bad(429, "Muitas tentativas. Espere um minuto.")
  if (!secretKeyConfigured()) return action.startsWith("login-") ? loginFailed("not_configured", 503) : bad(503, "As passkeys ainda não estão disponíveis neste servidor.")
  const db = createSecretClient()
  const { rpID, origins } = config()

  // ------------------------------------------------------------ registration (signed in)
  if (action === "register-options" || action === "register-verify") {
    const supabase = (await createClient()) as unknown as SupabaseClient
    const { data } = await supabase.auth.getClaims()
    const userId = data?.claims?.sub
    const email = typeof data?.claims?.email === "string" ? data.claims.email : ""
    if (!userId) return bad(401, "Sua sessão expirou. Entre de novo.")

    if (action === "register-options") {
      const existing = await db.from("passkey_credentials").select("credential_id, transports").eq("user_id", userId)
      if (existing.error) return bad(503, "As passkeys ainda não estão disponíveis neste servidor.")
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userName: email || userId,
        userID: userHandle(userId),
        attestationType: "none",
        excludeCredentials: ((existing.data ?? []) as { credential_id: string; transports: string[] }[]).map((c) => ({ id: c.credential_id, transports: c.transports as never })),
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
      })
      const id = await storeChallenge(db, "register", options.challenge, userId)
      return id ? withChallengeCookie(NextResponse.json({ ok: true, options }), id) : bad(503)
    }

    const body = (await request.json().catch(() => null)) as { response?: RegistrationResponseJSON; label?: string } | null
    const taken = await takeChallenge(db, request, "register", userId)
    if (!body?.response || !("challenge" in taken)) {
      console.warn(`[passkey] register_failed reason=${"reason" in taken ? taken.reason : "bad_request"}`)
      return bad(400)
    }
    const challenge = taken.challenge
    try {
      const verification = await verifyRegistrationResponse({ response: body.response, expectedChallenge: challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true })
      if (!verification.verified || !verification.registrationInfo) return bad()
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
      const profile = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle()
      const first = ((profile.data as { display_name?: string | null } | null)?.display_name ?? email.split("@")[0] ?? "")
      const label = (body.label?.trim() || defaultPasskeyName(deviceLabel(request.headers.get("user-agent") ?? ""), first)).slice(0, 80)
      const saved = await db.from("passkey_credentials").insert({ user_id: userId, credential_id: credential.id, public_key: toBase64Url(credential.publicKey), counter: credential.counter, transports: credential.transports ?? [], device_type: credentialDeviceType, backed_up: credentialBackedUp, device_label: label })
      return saved.error ? bad(500, "Não consegui guardar a passkey agora.") : NextResponse.json({ ok: true })
    } catch {
      return bad()
    }
  }

  // ------------------------------------------------------------ sign-in (no session yet)
  if (action === "login-options") {
    const options = await generateAuthenticationOptions({ rpID, userVerification: "required" })
    const id = await storeChallenge(db, "login", options.challenge, null)
    return id ? withChallengeCookie(NextResponse.json({ ok: true, options }), id) : bad(503)
  }

  if (action === "login-verify") {
    const body = (await request.json().catch(() => null)) as { response?: AuthenticationResponseJSON; next?: string } | null
    const taken = await takeChallenge(db, request, "login", null)
    if (!body?.response?.id) return loginFailed("bad_request", 400)
    if (!("challenge" in taken)) return loginFailed(taken.reason, 400)
    // The proof cookie that marks "second step done" needs AUTH_COOKIE_SECRET. It is only REQUIRED by accounts that turned the second step on
    // (which cannot happen without the secret), so a missing secret must not stop everyone else from signing in.
    const secret = strongSecret()
    try {
      const stored = await db.from("passkey_credentials").select("id, user_id, public_key, counter, transports").eq("credential_id", body.response.id).maybeSingle()
      if (stored.error) return loginFailed("credential_not_found", 503, `db=${stored.error.code ?? "error"}`)
      const credential = stored.data as { id: string; user_id: string; public_key: string; counter: number; transports: string[] } | null
      if (!credential) return loginFailed("credential_not_found")

      const verdict = await verifyLoginAssertion({ response: body.response, challenge: taken.challenge, credential, rpID, origins })
      if (!verdict.ok) return loginFailed(verdict.reason)

      // The counter only goes up (an authenticator that always reports 0 stays at 0). Written with the secret key: the browser role cannot touch it.
      const updated = await db.from("passkey_credentials").update({ counter: verdict.newCounter, last_used_at: new Date().toISOString() }).eq("id", credential.id)
      if (updated.error) console.warn(`[passkey] counter_update_failed db=${updated.error.code ?? "error"}`)

      const user = await db.auth.admin.getUserById(credential.user_id)
      const email = user.data.user?.email
      if (!email) return loginFailed("user_not_found", 401, `auth=${user.error?.code ?? "no_email"}`)
      const link = await db.auth.admin.generateLink({ type: "magiclink", email })
      const tokenHash = link.data?.properties?.hashed_token
      if (!tokenHash) return loginFailed("link_failed", 401, `auth=${link.error?.code ?? "no_token"}`)
      const supabase = await createClient()
      let session = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash })
      // Newer Supabase versions call the same one-time link type "email"; try it when "magiclink" is refused.
      if (session.error || !session.data.session) session = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash })
      if (session.error || !session.data.session) return loginFailed("session_failed", 401, `auth=${session.error?.code ?? session.error?.status ?? "no_session"}`)

      const response = NextResponse.json({ ok: true, next: safeNextPath(body.next ?? null) })
      if (secret) {
        // Strong authentication: a passkey needs the device AND the person (biometric or PIN), so no e-mail code on top.
        response.cookies.set(STRONG_COOKIE, await signStrongProof(secret, credential.user_id, sessionIdOf(session.data.session.access_token)), strongCookieOptions)
      } else {
        console.warn("[passkey] signed in without the second-step proof cookie: AUTH_COOKIE_SECRET is not set (or shorter than 32 characters)")
      }
      return response
    } catch (error) {
      return loginFailed("verify_failed", 500, `error=${error instanceof Error ? error.name : "unknown"}`)
    }
  }

  return bad(404)
}
