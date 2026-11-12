"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { headers } from "next/headers"

import { mailer } from "@/lib/mail/mailer"
import { SUPPORT_EMAIL } from "@/lib/support"
import { createClient } from "@/lib/supabase/server"

import { buildReportEmail, REPORT_WINDOW_MS, safeRoute, validateReport, withinRateLimit } from "./report"

export type ReportResult = { ok: true } | { ok: false; error: string; retryable?: boolean }

// When the support_reports table is not there yet the limit still holds for this server instance.
const memory = new Map<string, number[]>()

/** Sends the problem report to the support address (reply-to: the person), and keeps a copy in support_reports when that table exists. */
export async function sendProblemReport(input: { text: string; route: string }): Promise<ReportResult> {
  const check = validateReport(String(input.text ?? ""))
  if (!check.ok) return { ok: false, error: check.error }

  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  const email = typeof data?.claims?.email === "string" ? data.claims.email : ""
  if (!userId || !email) return { ok: false, error: "Sua sessão expirou. Entre de novo." }

  const now = Date.now()
  const since = new Date(now - REPORT_WINDOW_MS).toISOString()
  const stored = await supabase.from("support_reports").select("created_at").eq("user_id", userId).gte("created_at", since)
  const times = stored.error ? (memory.get(userId) ?? []) : (stored.data ?? []).map((row: { created_at: string }) => Date.parse(row.created_at))
  if (!withinRateLimit(times, now)) return { ok: false, error: "Você já enviou vários relatos na última hora. Tente de novo mais tarde." }

  const profile = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle()
  const name = (profile.data as { display_name?: string | null } | null)?.display_name ?? ""
  const jar = await headers()
  const route = safeRoute(String(input.route ?? ""))
  const userAgent = jar.get("user-agent") ?? ""
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"
  const mail = buildReportEmail(check.text, { name, email, route, version, userAgent, at: new Date(now) })

  const sent = await mailer.send({ to: SUPPORT_EMAIL, subject: mail.subject, text: mail.body, replyTo: email })
  if (!sent.ok) {
    return { ok: false, retryable: true, error: sent.reason === "not_configured" ? `O envio de relatos ainda não está configurado. Escreva para ${SUPPORT_EMAIL}.` : "Não consegui enviar agora. Tente de novo em instantes." }
  }

  memory.set(userId, [...times, now].slice(-10))
  // The copy is best effort: a missing table must not turn a delivered report into an error.
  await supabase.from("support_reports").insert({ user_id: userId, message: check.text, route, user_agent: userAgent.slice(0, 300), app_version: version })
  return { ok: true }
}
