// Pure helpers of the Perfil tab: the password checklist and strength, the initials, "Membro desde …" and "is the form dirty".
// Passwords only ever pass through here as arguments: nothing is stored, logged or returned.
import { PASSWORD_RULES } from "@/features/auth/schemas"

export type PasswordRequirement = { key: string; label: string; met: boolean }

/** The four rules of a new password ("Mínimo de 8 caracteres", "Letra maiúscula", …) and whether the value meets each one. */
export function passwordRequirements(value: string): PasswordRequirement[] {
  return PASSWORD_RULES.map((rule) => ({ key: rule.key, label: rule.label, met: rule.test(value) }))
}

export type PasswordStrengthLevel = "empty" | "weak" | "medium" | "strong"
export type PasswordStrengthResult = { level: PasswordStrengthLevel; label: string; percent: number }

/**
 * Empty until something is typed. Weak while any rule is missing; medium when all four are met; strong when they are met and the
 * password has 12 or more characters (or 10 or more with a symbol).
 */
export function passwordStrength(value: string): PasswordStrengthResult {
  if (value === "") return { level: "empty", label: "—", percent: 0 }
  const met = passwordRequirements(value).filter((r) => r.met).length
  if (met < 4) return { level: "weak", label: "Fraca", percent: Math.max(10, met * 15) }
  const symbol = /[^A-Za-z0-9]/.test(value)
  if (value.length >= 12 || (symbol && value.length >= 10)) return { level: "strong", label: "Forte", percent: 100 }
  return { level: "medium", label: "Média", percent: 66 }
}

/** The "Alterar senha" button is enabled only when every rule passes (and the password is not absurdly long) and both fields match. */
export function canChangePassword(password: string, confirm: string): boolean {
  return password.length <= 72 && passwordRequirements(password).every((r) => r.met) && password === confirm
}

/** "JS" for "João Silva", "M" for "Maria", the e-mail's first letter when there is no name, "?" for nothing. */
export function profileInitials(name: string, email = ""): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return email.trim() ? email.trim()[0].toUpperCase() : "?"
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

/** "novembro 2026" from the account's creation instant (São Paulo calendar), or null when there is no valid date. */
export function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric" }).formatToParts(date)
  const year = parts.find((p) => p.type === "year")?.value
  const month = Number(parts.find((p) => p.type === "month")?.value)
  return year && month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${year}` : null
}

/** True when the name or the phone differs from what is saved (ignoring surrounding spaces). */
export function isProfileDirty(saved: { name: string; phone: string }, current: { name: string; phone: string }): boolean {
  return saved.name.trim() !== current.name.trim() || saved.phone.trim() !== current.phone.trim()
}
