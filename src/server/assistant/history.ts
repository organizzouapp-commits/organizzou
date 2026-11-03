import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { MAX_HISTORY_MESSAGES } from "./usage"

/** One running conversation per person, in `assistant_messages`. Only the visible text (and what was created) is kept, never tool internals. */
export type StoredMessage = { id: string; role: "user" | "assistant"; text: string; actions?: { label: string; href: string }[]; at: string }

type Row = { id: string; role: "user" | "assistant"; body: { text?: string; actions?: { label: string; href: string }[] }; created_at: string }

export async function loadHistory(supabase: SupabaseClient, limit = 40): Promise<StoredMessage[]> {
  const { data, error } = await supabase.from("assistant_messages").select("id, role, body, created_at").order("created_at", { ascending: false }).limit(limit)
  if (error) return []
  return ((data ?? []) as Row[]).reverse().map((r) => ({ id: r.id, role: r.role, text: r.body?.text ?? "", actions: r.body?.actions, at: r.created_at }))
}

/** What the model sees of the past: the last few turns, as plain text, starting with a user turn and alternating roles. */
export function modelHistory(messages: StoredMessage[]): { role: "user" | "assistant"; text: string }[] {
  const recent = messages.filter((m) => m.text.trim()).slice(-MAX_HISTORY_MESSAGES)
  const merged: { role: "user" | "assistant"; text: string }[] = []
  for (const m of recent) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) last.text += `\n${m.text}`
    else merged.push({ role: m.role, text: m.text })
  }
  while (merged.length > 0 && merged[0].role !== "user") merged.shift()
  return merged
}

export async function saveMessage(supabase: SupabaseClient, userId: string, role: "user" | "assistant", body: { text: string; actions?: { label: string; href: string }[] }) {
  await supabase.from("assistant_messages").insert({ user_id: userId, role, body })
}
