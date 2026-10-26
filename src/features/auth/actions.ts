"use server"

import { redirect } from "next/navigation"

import { getSiteUrl } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "./schemas"

export type ActionResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; error: string }

const GENERIC_ERROR = "Não consegui concluir. Verifique a conexão e tente de novo."

function messageFor(error: { code?: string; message?: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos."
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada."
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com esse e-mail. Tente entrar."
    case "weak_password":
      return "Essa senha é fraca. Use uma senha maior e mais difícil de adivinhar."
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde um minuto e tente de novo."
    case "same_password":
      return "A nova senha precisa ser diferente da atual."
    default:
      return GENERIC_ERROR
  }
}

export async function signIn(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { ok: false, error: messageFor(error) }

  return { ok: true }
}

export async function signUp(input: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  })
  if (error) return { ok: false, error: messageFor(error) }

  return { ok: true, needsEmailConfirmation: !data.session }
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/redefinir-senha`,
  })
  // Same answer whether or not the e-mail exists, to avoid account enumeration.
  if (error && error.code === "over_email_send_rate_limit") {
    return { ok: false, error: messageFor(error) }
  }

  return { ok: true }
}

export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) {
    return { ok: false, error: "O link expirou. Peça um novo link de recuperação." }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { ok: false, error: messageFor(error) }

  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/entrar")
}
