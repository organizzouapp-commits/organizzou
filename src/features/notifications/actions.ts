"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { getSession } from "@/lib/supabase/session"

export type NotificationResult = { ok: true } | { ok: false; error: string }

const ERROR = "Não consegui atualizar as notificações."

/** Marks one notification as read (or unread). Answers ok only when the row really changed. */
export async function markNotificationRead(input: { id: string; read: boolean }): Promise<NotificationResult> {
  const parsed = z.object({ id: z.uuid(), read: z.boolean() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: ERROR }
  const { supabase } = await getSession()
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from("notifications")
    .update({ read_at: parsed.data.read ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .select("id")
  return error || !data || data.length === 0 ? { ok: false, error: ERROR } : { ok: true }
}

/** Marks every unread notification of the person as read. */
export async function markAllNotificationsRead(): Promise<NotificationResult> {
  const { supabase } = await getSession()
  const { error } = await (supabase as unknown as SupabaseClient).from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null)
  return error ? { ok: false, error: ERROR } : { ok: true }
}
