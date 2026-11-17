"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { headers } from "next/headers"

import { parseNotificationPrefs, type NotificationPrefs } from "@/features/settings/notification-prefs"
import { PUSH_FAILURE_MESSAGES, type FailureCounts, type PushFailureCode } from "@/lib/push/failures"
import { sendToUser, vapidConfigProblem, vapidPublicKey, vapidSubject } from "@/lib/push/send"
import { normalizeSubject, VAPID_PROBLEM_MESSAGES } from "@/lib/push/vapid"
import { createLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"

import { deviceLabel, subscriptionSchema, type PushSubscriptionInput } from "./push"

export type PushDevice = { id: string; label: string; createdAt: string; endpoint: string }
type Fail = { ok: false; error: string }

const testLimiter = createLimiter({ max: 5, windowMs: 10 * 60 * 1000 })

/** Why a request failed, as a short code the screen can show (and the debug panel prints). */
export type PushReason = "not_configured" | "no_session" | "invalid_subscription" | "save_failed" | "device_not_saved" | "no_devices" | "rate_limited" | PushFailureCode

async function session() {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: data?.claims?.sub ?? null }
}

/**
 * The public key the browser subscribes with (it is public by design). When the server's key pair is missing or broken it says exactly what
 * is wrong instead of returning nothing, so the screen never fails silently.
 */
export async function getPushPublicKey(): Promise<{ ok: true; key: string } | { ok: false; reason: "not_configured"; problem: string; error: string }> {
  const problem = vapidConfigProblem()
  if (problem) {
    console.warn(`[push] public_key_unavailable problem=${problem}`)
    return { ok: false, reason: "not_configured", problem, error: VAPID_PROBLEM_MESSAGES[problem] }
  }
  return { ok: true, key: vapidPublicKey() }
}

/** Stores this device's subscription for the signed-in person (the table's row level security keeps it theirs). */
export async function savePushSubscription(input: PushSubscriptionInput & { label?: string }): Promise<{ ok: true } | Fail> {
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) {
    console.warn(`[push] save_failed reason=invalid_subscription field=${parsed.error.issues[0]?.path.join(".") || "?"}`)
    return { ok: false, error: "Esse aparelho não mandou os dados esperados. Tente de novo." }
  }
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const userAgent = parsed.data.userAgent ?? (await headers()).get("user-agent") ?? ""
  const label = (input.label || deviceLabel(userAgent)).slice(0, 80)
  const row = { user_id: userId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, user_agent: userAgent.slice(0, 300), device_label: label }
  let { error } = await supabase.from("push_subscriptions").upsert(row, { onConflict: "endpoint" })
  // The label column arrives with a prepared migration: until then the subscription is saved without it.
  if (error && /device_label/.test(error.message)) {
    const { device_label: _drop, ...plain } = row
    void _drop
    ;({ error } = await supabase.from("push_subscriptions").upsert(plain, { onConflict: "endpoint" }))
  }
  if (error) {
    console.warn(`[push] save_failed reason=db code=${error.code ?? "none"}`)
    const missing = error.code === "42P01" || error.code === "PGRST205"
    const denied = error.code === "42501"
    return { ok: false, error: missing ? "O servidor ainda não tem a tabela de aparelhos (falta aplicar a migração de notificações)." : denied ? "Sua conta não tem permissão para guardar este aparelho. Entre de novo e tente outra vez." : "Não consegui guardar esse aparelho no servidor agora. Tente de novo." }
  }
  return { ok: true }
}

export async function listPushDevices(): Promise<{ ok: true; devices: PushDevice[] } | Fail> {
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  type Row = { id: string; endpoint: string; user_agent?: string | null; device_label?: string | null; created_at: string }
  let rows: Row[] | null = null
  const first = await supabase.from("push_subscriptions").select("id, endpoint, user_agent, device_label, created_at").eq("user_id", userId).order("created_at")
  if (!first.error) rows = first.data as Row[]
  else if (/device_label/.test(first.error.message)) {
    // The label column arrives with a prepared migration: until then the list is read without it.
    const plain = await supabase.from("push_subscriptions").select("id, endpoint, user_agent, created_at").eq("user_id", userId).order("created_at")
    if (!plain.error) rows = plain.data as Row[]
  }
  if (!rows) return { ok: true, devices: [] }
  return { ok: true, devices: rows.map((r) => ({ id: r.id, endpoint: r.endpoint, createdAt: r.created_at, label: r.device_label || deviceLabel(r.user_agent ?? "") })) }
}

export async function removePushDevice(id: string): Promise<{ ok: true } | Fail> {
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const { error } = await supabase.from("push_subscriptions").delete().eq("id", id).eq("user_id", userId)
  return error ? { ok: false, error: "Não consegui remover esse aparelho." } : { ok: true }
}

export type PushTestResult =
  | { ok: true; sent: number; devices: number; failed: number; failures: FailureCounts }
  | { ok: false; error: string; reason: PushReason }

/**
 * Sends one notification to prove the whole path works. With `endpoint` it goes only to THIS device (so a stale device of the same person can
 * never make the test look successful). It says "sent" only when the push service accepted it for at least one device; otherwise it says why.
 * Limited to a few per 10 minutes.
 */
export async function sendTestPush(input?: { endpoint?: string }): Promise<PushTestResult> {
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, reason: "no_session", error: "Sua sessão expirou. Entre de novo." }
  const problem = vapidConfigProblem()
  if (problem) return { ok: false, reason: "not_configured", error: VAPID_PROBLEM_MESSAGES[problem] }
  if (!testLimiter.hit(userId).ok) return { ok: false, reason: "rate_limited", error: "Você já enviou vários testes. Espere alguns minutos." }

  let only: string | undefined
  if (input?.endpoint) {
    const found = await supabase.from("push_subscriptions").select("id").eq("user_id", userId).eq("endpoint", input.endpoint).maybeSingle()
    only = (found.data as { id: string } | null)?.id
    if (!only) return { ok: false, reason: "device_not_saved", error: "Este aparelho ainda não está salvo no servidor. Desative e ative as notificações de novo neste aparelho." }
  }
  const result = await sendToUser(supabase, userId, { title: "Organizzou", body: "Tudo certo! As notificações estão funcionando neste aparelho.", url: "/dashboard/configuracoes?aba=avisos", tag: "test", sticky: true }, only)
  console.warn(`[push] test sent=${result.sent} failed=${result.failed} removed=${result.removed} devices=${result.devices}`)
  if (result.problem) return { ok: false, reason: "not_configured", error: VAPID_PROBLEM_MESSAGES[result.problem] }
  if (result.devices === 0) return { ok: false, reason: "no_devices", error: "Nenhum aparelho salvo. Ative as notificações neste aparelho e tente de novo." }
  if (result.sent === 0) {
    const [top] = (Object.entries(result.failures) as [PushFailureCode, number][]).sort((x, y) => y[1] - x[1])
    const code: PushFailureCode = top?.[0] ?? "unknown"
    return { ok: false, reason: code, error: PUSH_FAILURE_MESSAGES[code] }
  }
  return { ok: true, sent: result.sent, devices: result.devices, failed: result.failed + result.removed, failures: result.failures }
}

/** Server facts for the debug panel (Avisos with ?debug=1): no keys, no endpoints, only yes/no and codes. */
export async function pushDiagnostics(input?: { endpoint?: string }): Promise<{ ok: true; configured: boolean; problem: string | null; subjectValid: boolean; devices: number; thisDeviceSaved: boolean | null } | Fail> {
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const problem = vapidConfigProblem()
  const rows = await supabase.from("push_subscriptions").select("endpoint").eq("user_id", userId)
  const endpoints = ((rows.data ?? []) as { endpoint: string }[]).map((r) => r.endpoint)
  return { ok: true, configured: problem === null, problem, subjectValid: normalizeSubject(process.env.VAPID_SUBJECT).valid && vapidSubject().length > 0, devices: endpoints.length, thisDeviceSaved: input?.endpoint ? endpoints.includes(input.endpoint) : null }
}

// ---------------------------------------------------------------- the choices of "Avisos", per person (not only per device)

/** The saved choices, or null when none are saved yet (or the column is not there yet): the screen then keeps what is on the device. */
export async function loadNotificationSettings(): Promise<NotificationPrefs | null> {
  const { supabase, userId } = await session()
  if (!userId) return null
  const { data, error } = await supabase.from("notification_preferences").select("settings").eq("user_id", userId).maybeSingle()
  const settings = (data as { settings?: Record<string, unknown> } | null)?.settings
  if (error || !settings || Object.keys(settings).length === 0) return null
  return parseNotificationPrefs(settings)
}

export async function saveNotificationSettings(input: NotificationPrefs): Promise<{ ok: true } | Fail> {
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const prefs = parseNotificationPrefs(input)
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, settings: prefs }, { onConflict: "user_id" })
  return error ? { ok: false, error: "Não consegui guardar na sua conta. As escolhas ficaram neste aparelho." } : { ok: true }
}
