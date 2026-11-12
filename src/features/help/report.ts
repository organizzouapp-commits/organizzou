// The "Reportar problema" rules, apart from the server: validation, the rate limit and the e-mail body. Pure.

export const REPORT_MIN = 10
export const REPORT_MAX = 2000
export const REPORT_LIMIT = 5
export const REPORT_WINDOW_MS = 60 * 60 * 1000

export type ReportCheck = { ok: true; text: string } | { ok: false; error: string }

export function validateReport(raw: string): ReportCheck {
  const text = raw.trim()
  if (text.length < REPORT_MIN) return { ok: false, error: `Descreva o problema com pelo menos ${REPORT_MIN} caracteres.` }
  if (text.length > REPORT_MAX) return { ok: false, error: `Use no máximo ${REPORT_MAX} caracteres.` }
  return { ok: true, text }
}

/** True while the person still has sends left: fewer than `limit` of the given timestamps (ms) fall inside the window. */
export function withinRateLimit(sentAt: number[], now: number, limit = REPORT_LIMIT, windowMs = REPORT_WINDOW_MS): boolean {
  return sentAt.filter((t) => now - t < windowMs).length < limit
}

/** Only the route path is kept (never a query string, which could carry something private). */
export const safeRoute = (route: string) => (route.startsWith("/") ? route.split(/[?#]/)[0].slice(0, 200) : "")

export type ReportContext = { name: string; email: string; route: string; version: string; userAgent: string; at: Date }

/** The support e-mail: the message and where it came from. No tokens, no vault data: only what is listed here. */
export function buildReportEmail(text: string, ctx: ReportContext): { subject: string; body: string } {
  const lines = [text, "", "—", `Nome: ${ctx.name || "(sem nome)"}`, `E-mail da conta: ${ctx.email}`, `Tela: ${safeRoute(ctx.route) || "(desconhecida)"}`, `Versão do app: ${ctx.version}`, `Navegador: ${ctx.userAgent.slice(0, 300) || "(desconhecido)"}`, `Enviado em: ${ctx.at.toISOString()}`]
  return { subject: `[Organizzou] Problema relatado por ${ctx.email}`, body: lines.join("\n") }
}
