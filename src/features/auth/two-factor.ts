// The rules of the two-step e-mail code, apart from the server: how a code looks, how long it lives, how often it may be asked for and tried.
// Pure, so every rule is tested. The code itself is generated and compared only on the server (two-factor-server.ts).

export const CODE_LENGTH = 6
/** A code lives 10 minutes and works once. */
export const CODE_TTL_MS = 10 * 60 * 1000
/** After this many wrong tries the code is dead and a new one has to be asked for. */
export const MAX_ATTEMPTS = 5
/** At most 3 codes per 15 minutes per person. */
export const MAX_SENDS = 3
export const SEND_WINDOW_MS = 15 * 60 * 1000
/** The screen lets the person ask again after this long. */
export const RESEND_COOLDOWN_SECONDS = 60

export type CodePurpose = "enable" | "disable" | "login"
export const isPurpose = (value: unknown): value is CodePurpose => value === "enable" || value === "disable" || value === "login"

/** Keeps only the digits and cuts to 6 (a pasted "123 456" or "123-456" works). */
export const cleanCode = (raw: string): string => raw.replace(/\D/g, "").slice(0, CODE_LENGTH)
export const isCompleteCode = (raw: string): boolean => cleanCode(raw).length === CODE_LENGTH

/** "patrick.toledo@gmail.com" -> "p***@gmail.com". */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@")
  if (!domain) return "***"
  return `${name.slice(0, 1)}***@${domain}`
}

/** May another code be sent? `sentAt` are the times (ms) of the codes already sent to this person. */
export function canSendCode(sentAt: number[], now: number): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const recent = sentAt.filter((t) => now - t < SEND_WINDOW_MS).sort((a, b) => a - b)
  if (recent.length < MAX_SENDS) return { ok: true }
  return { ok: false, retryAfterSeconds: Math.ceil((SEND_WINDOW_MS - (now - recent[0])) / 1000) }
}

export type CodeRecord = { expires_at: string; attempts: number; consumed_at: string | null }

/** Why a stored code cannot be used any more, or null when it can still be tried. */
export function codeProblem(record: CodeRecord | null, now: number): "none" | "expired" | "used" | "locked" | null {
  if (!record) return "none"
  if (record.consumed_at) return "used"
  if (Date.parse(record.expires_at) <= now) return "expired"
  if (record.attempts >= MAX_ATTEMPTS) return "locked"
  return null
}

/** The one message shown for every failure of the code: it never says which part was wrong. */
export const GENERIC_CODE_ERROR = "Código inválido ou expirado. Peça um novo código."

/** The e-mail with the code (short, pt-BR, no links). Returned as plain text. */
export function codeEmail(code: string, purpose: CodePurpose): { subject: string; text: string } {
  const what = purpose === "login" ? "entrar na Organizzou" : purpose === "enable" ? "ativar a verificação em duas etapas" : "desativar a verificação em duas etapas"
  return {
    subject: `Seu código da Organizzou: ${code}`,
    text: [`Use este código para ${what}:`, "", `    ${code}`, "", "Ele vale por 10 minutos e só funciona uma vez.", "", "Se não foi você, ignore este e-mail e troque a sua senha em Configurações."].join("\n"),
  }
}
