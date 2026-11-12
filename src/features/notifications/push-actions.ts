"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { headers } from "next/headers"

import { parseNotificationPrefs, type NotificationPrefs } from "@/features/settings/notification-prefs"
import { sendToUser, pushConfigured, vapidPublicKey } from "@/lib/push/send"
import { createLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"

import { deviceLabel, subscriptionSchema, type PushSubscriptionInput } from "./push"

export type PushDevice = { id: string; label: string; createdAt: string; endpoint: string }
type Fail = { ok: false; error: string }

const testLimiter = createLimiter({ max: 5, windowMs: 10 * 60 * 1000 })
const NOT_READY = "As notificações ainda não estão ligadas neste servidor. Avise o suporte."

async function session() {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: data?.claims?.sub ?? null }
}

/** The public key the browser subscribes with (it is public by design), or null while the server has no keys. */
export async function getPushPublicKey(): Promise<string | null> {
  return pushConfigured() ? vapidPublicKey() : null
}

/** Stores this device's subscription for the signed-in person (the table's row level security keeps it theirs). */
export async function savePushSubscription(input: PushSubscriptionInput & { label?: string }): Promise<{ ok: true } | Fail> {
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Esse aparelho não mandou os dados esperados. Tente de novo." }
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
  return error ? { ok: false, error: "Não consegui guardar esse aparelho agora. Tente de novo." } : { ok: true }
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

/** Sends one notification to the person's own devices, to prove the whole path works. Limited to a few per 10 minutes. */
export async function sendTestPush(): Promise<{ ok: true; sent: number } | Fail> {
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  if (!pushConfigured()) return { ok: false, error: NOT_READY }
  const allowed = testLimiter.hit(userId)
  if (!allowed.ok) return { ok: false, error: "Você já enviou vários testes. Espere alguns minutos." }
  const result = await sendToUser(supabase, userId, { title: "Organizzou", body: "Tudo certo! As notificações estão funcionando neste aparelho.", url: "/dashboard/configuracoes?aba=avisos", tag: "test" })
  return result.sent > 0 ? { ok: true, sent: result.sent } : { ok: false, error: "Nenhum aparelho recebeu o teste. Ative as notificações neste aparelho e tente de novo." }
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
