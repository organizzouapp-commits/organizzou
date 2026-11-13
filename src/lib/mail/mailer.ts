import "server-only"

// The one place the app sends e-mail from (support reports, the two-step codes). Provider: Resend over its REST API; the interface is
// the swap point. Server only: RESEND_API_KEY and EMAIL_FROM never reach the client.

export type MailMessage = { to: string; subject: string; text: string; replyTo?: string }
export type MailResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" }

export interface Mailer {
  send(message: MailMessage): Promise<MailResult>
}

export const resendMailer: Mailer = {
  async send({ to, subject, text, replyTo }) {
    const key = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!key || !from) {
      // Non-sensitive: only says what is missing, never a value.
      console.warn("[mailer] RESEND_API_KEY or EMAIL_FROM is not set; e-mail was not sent.")
      return { ok: false, reason: "not_configured" }
    }
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) {
        console.warn(`[mailer] provider answered ${response.status}.`)
        return { ok: false, reason: "failed" }
      }
      return { ok: true }
    } catch {
      console.warn("[mailer] could not reach the provider.")
      return { ok: false, reason: "failed" }
    }
  },
}

export const mailer: Mailer = resendMailer
