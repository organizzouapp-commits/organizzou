"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

import { createSecretClient, secretKeyConfigured } from "@/lib/admin/secret"
import { requiresSecondStep, signStrongProof, STRONG_COOKIE, strongCookieOptions, strongSecret, verifyStrongProof } from "@/lib/auth/strong-auth"
import { mailer } from "@/lib/mail/mailer"
import { safeNextPath } from "@/lib/safe-next"
import { createClient } from "@/lib/supabase/server"

import { checkCode, issueCode } from "./two-factor-server"
import { cleanCode, codeEmail, GENERIC_CODE_ERROR, isCompleteCode, isPurpose, maskEmail, type CodePurpose } from "./two-factor"

type Fail = { ok: false; error: string; retryAfterSeconds?: number }
export type SendResult = { ok: true; maskedEmail: string } | Fail
export type VerifyResult = { ok: true; next: string } | Fail

const UNAVAILABLE = "A verificação por e-mail ainda não está configurada neste servidor. Avise o suporte."

async function whoAmI() {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { supabase, userId: claims.sub, email: typeof claims.email === "string" ? claims.email : "", sessionId: String((claims as { session_id?: unknown }).session_id ?? ""), claims }
}

/** Sends a code to the account's own e-mail (the one used to sign up): never to an address the browser supplies. */
export async function sendTwoFactorCode(purpose: CodePurpose): Promise<SendResult> {
  if (!isPurpose(purpose)) return { ok: false, error: GENERIC_CODE_ERROR }
  const me = await whoAmI()
  if (!me || !me.email) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  if (!secretKeyConfigured() || !strongSecret()) return { ok: false, error: UNAVAILABLE }
  const issued = await issueCode(createSecretClient(), me.userId, purpose)
  if (!issued.ok) {
    if ("unavailable" in issued) return { ok: false, error: UNAVAILABLE }
    return { ok: false, error: "Você já pediu vários códigos. Espere um pouco e tente de novo.", retryAfterSeconds: issued.retryAfterSeconds }
  }
  const mail = codeEmail(issued.code, purpose)
  const sent = await mailer.send({ to: me.email, subject: mail.subject, text: mail.text })
  if (!sent.ok) return { ok: false, error: sent.reason === "not_configured" ? "O envio de e-mails ainda não está configurado neste servidor. Avise o suporte." : "Não consegui enviar o e-mail agora. Tente de novo em instantes." }
  return { ok: true, maskedEmail: maskEmail(me.email) }
}

/** Checks the code. On success: "enable" / "disable" change the flag the server enforces; every purpose leaves the signed proof cookie for THIS session. */
export async function verifyTwoFactorCode(purpose: CodePurpose, rawCode: string, next?: string): Promise<VerifyResult> {
  if (!isPurpose(purpose) || !isCompleteCode(rawCode)) return { ok: false, error: GENERIC_CODE_ERROR }
  const me = await whoAmI()
  if (!me) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const secret = strongSecret()
  if (!secretKeyConfigured() || !secret) return { ok: false, error: UNAVAILABLE }
  const db = createSecretClient()
  if (!(await checkCode(db, me.userId, purpose, cleanCode(rawCode)))) return { ok: false, error: GENERIC_CODE_ERROR }

  if (purpose === "enable" || purpose === "disable") {
    const target = await db.auth.admin.getUserById(me.userId)
    const current = (target.data.user?.app_metadata ?? {}) as Record<string, unknown>
    const updated = await db.auth.admin.updateUserById(me.userId, { app_metadata: { ...current, two_factor: purpose === "enable" } })
    if (updated.error) return { ok: false, error: "Não consegui salvar a mudança agora. Tente de novo." }
    // A mirror for the settings screen; the column arrives with a prepared migration, so a failure here is fine.
    await db.from("profiles").update({ two_factor_enabled: purpose === "enable" }).eq("id", me.userId)
  }
  const jar = await cookies()
  jar.set(STRONG_COOKIE, await signStrongProof(secret, me.userId, me.sessionId), strongCookieOptions)
  return { ok: true, next: safeNextPath(next ?? null) }
}

/** What the settings screen shows: is the second step on, and can it be turned on at all on this server. */
export async function getTwoFactorStatus(): Promise<{ enabled: boolean; available: boolean }> {
  const me = await whoAmI()
  if (!me) return { enabled: false, available: false }
  const available = secretKeyConfigured() && Boolean(strongSecret())
  const profile = await me.supabase.from("profiles").select("two_factor_enabled").eq("id", me.userId).maybeSingle()
  const mirrored = (profile.data as { two_factor_enabled?: boolean } | null)?.two_factor_enabled
  return { enabled: typeof mirrored === "boolean" ? mirrored : requiresSecondStep(me.claims), available }
}

/** For the verification page: has this session already passed the second step? */
export async function sessionIsVerified(): Promise<boolean> {
  const me = await whoAmI()
  if (!me) return false
  if (!requiresSecondStep(me.claims)) return true
  const jar = await cookies()
  return verifyStrongProof(strongSecret(), jar.get(STRONG_COOKIE)?.value, me.userId, me.sessionId)
}
