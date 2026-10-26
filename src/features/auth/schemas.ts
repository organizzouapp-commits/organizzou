import { z } from "zod"

const email = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .pipe(z.email("Esse e-mail não parece válido."))

export const PASSWORD_RULES = [
  { key: "length", label: "Mínimo de 8 caracteres", test: (value: string) => value.length >= 8 },
  { key: "upper", label: "Letra maiúscula", test: (value: string) => /[A-Z]/.test(value) },
  { key: "lower", label: "Letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { key: "digit", label: "Número", test: (value: string) => /\d/.test(value) },
] as const

const password = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(72, "Use no máximo 72 caracteres.")
  .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
  .regex(/[a-z]/, "Inclua uma letra minúscula.")
  .regex(/\d/, "Inclua um número.")

/** Digits only, e.g. "(11) 91234-5678" -> "11912345678". */
export function phoneDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")
}

/** Brazilian mask: (11) 91234-5678 or (11) 3123-4567. */
export function maskPhone(value: string) {
  const digits = phoneDigits(value).slice(0, 11)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  const split = digits.length > 10 ? 7 : 6
  if (digits.length <= split) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}

/** "(11) 91234-5678" -> "+5511912345678". Returns null when it is not a valid Brazilian number. */
export function toE164(value: string) {
  const digits = phoneDigits(value)
  if (digits.length !== 10 && digits.length !== 11) return null
  const area = Number(digits.slice(0, 2))
  if (area < 11 || area > 99) return null
  if (digits.length === 11 && digits[2] !== "9") return null
  return `+55${digits}`
}

const phone = z
  .string()
  .trim()
  .min(1, "Informe seu telefone.")
  .refine((value) => toE164(value) !== null, "Informe um telefone válido com DDD.")

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
})

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(80, "Use no máximo 80 caracteres."),
  email,
  phone,
  password,
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não são iguais.",
  })

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
