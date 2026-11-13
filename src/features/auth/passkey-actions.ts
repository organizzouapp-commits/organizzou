"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"

export type PasskeyRow = { id: string; label: string; createdAt: string; lastUsedAt: string | null }
type Fail = { ok: false; error: string }

async function me() {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: data?.claims?.sub ?? null }
}

/** The person's own passkeys (row level security: they can read only theirs). An empty list when the table is not there yet. */
export async function listPasskeys(): Promise<PasskeyRow[]> {
  const { supabase, userId } = await me()
  if (!userId) return []
  const { data, error } = await supabase.from("passkey_credentials").select("id, device_label, created_at, last_used_at").eq("user_id", userId).order("created_at")
  if (error) return []
  return ((data ?? []) as { id: string; device_label: string; created_at: string; last_used_at: string | null }[]).map((r) => ({ id: r.id, label: r.device_label, createdAt: r.created_at, lastUsedAt: r.last_used_at }))
}

export async function renamePasskey(id: string, label: string): Promise<{ ok: true } | Fail> {
  const name = label.trim().slice(0, 80)
  if (!name) return { ok: false, error: "Dê um nome à passkey." }
  const { supabase, userId } = await me()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const { error } = await supabase.from("passkey_credentials").update({ device_label: name }).eq("id", id).eq("user_id", userId)
  return error ? { ok: false, error: "Não consegui renomear agora." } : { ok: true }
}

export async function removePasskey(id: string): Promise<{ ok: true } | Fail> {
  const { supabase, userId } = await me()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const { error } = await supabase.from("passkey_credentials").delete().eq("id", id).eq("user_id", userId)
  return error ? { ok: false, error: "Não consegui remover agora." } : { ok: true }
}

/** For the verification screen: does this person have a passkey to offer as the other method? */
export async function hasPasskey(): Promise<boolean> {
  return (await listPasskeys()).length > 0
}
