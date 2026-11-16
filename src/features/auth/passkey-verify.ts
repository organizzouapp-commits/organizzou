// The verification of a passkey sign-in, without any database or network: it checks the assertion with the site's real id and origins, accepts
// authenticators whose counter stays at 0, and names the reason when it refuses. Pure apart from the signature check, so it is tested with real
// (locally signed) assertions.
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server"

import { fromBase64Url, type PasskeyFailReason } from "./passkey"

export type StoredCredential = { user_id: string; public_key: string; counter: number | string; transports?: string[] | null }

export type LoginVerdict = { ok: true; newCounter: number } | { ok: false; reason: PasskeyFailReason }

/** The user id a discoverable credential's userHandle carries (the handle is the account id as text, see userHandle in passkey.ts). */
export function userIdFromHandle(handle: string | null | undefined): string | null {
  if (!handle) return null
  try {
    return Buffer.from(handle, "base64url").toString("utf8") || null
  } catch {
    return null
  }
}

/** Maps the library's error text to a reason code. Only the category leaves this function, never the text (it can contain challenge values). */
export function classifyVerifyError(message: string, code?: string): PasskeyFailReason {
  if (code === "BAD_ARGUMENT") return "bad_config"
  if (code === "UNEXPECTED_ORIGIN") return "origin_mismatch"
  if (code === "UNEXPECTED_RP_ID") return "rpid_mismatch"
  if (/counter value/i.test(message)) return "counter"
  if (/rp id hash/i.test(message)) return "rpid_mismatch"
  if (/response origin/i.test(message)) return "origin_mismatch"
  if (/challenge/i.test(message)) return "challenge_wrong"
  if (/user verification|user not present/i.test(message)) return "user_not_verified"
  return "verify_failed"
}

/**
 * Verifies the assertion against the stored credential. The counter is enforced by the library only when either side is above 0, so
 * authenticators that always report 0 (Windows Hello, many platform passkeys) sign in fine. A userHandle, when the authenticator sends one,
 * must belong to the same account as the stored credential.
 */
export async function verifyLoginAssertion(input: { response: AuthenticationResponseJSON; challenge: string; credential: StoredCredential; rpID: string; origins: string[] }): Promise<LoginVerdict> {
  const { response, challenge, credential, rpID, origins } = input
  const handleOwner = userIdFromHandle(response.response?.userHandle)
  if (handleOwner && handleOwner !== credential.user_id) return { ok: false, reason: "user_handle_mismatch" }
  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: response.id, publicKey: fromBase64Url(credential.public_key), counter: Number(credential.counter) || 0, transports: (credential.transports ?? undefined) as never },
    })
    return verification.verified ? { ok: true, newCounter: verification.authenticationInfo.newCounter } : { ok: false, reason: "verify_failed" }
  } catch (error) {
    return { ok: false, reason: classifyVerifyError(error instanceof Error ? error.message : "", (error as { code?: string } | null)?.code) }
  }
}
