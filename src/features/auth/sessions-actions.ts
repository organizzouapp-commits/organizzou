"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { headers } from "next/headers"

import { createClient } from "@/lib/supabase/server"

import { orderSessions, placeFromHeaders, sessionLabel, type SessionListItem } from "./sessions"

type Fail = { ok: false; error: string }

async function me() {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  return { supabase, userId: claims?.sub ?? null, sessionId: String((claims as { session_id?: unknown } | undefined)?.session_id ?? "") }
}

/**
 * The person's active sessions, this device first. Read with their own session (row level security shows only theirs). When the table is
 * not there yet, or this session has not checked in, the list holds just the current session, built from the request itself.
 */
export async function listSessions(): Promise<{ sessions: SessionListItem[]; managed: boolean }> {
  const { supabase, userId, sessionId } = await me()
  if (!userId) return { sessions: [], managed: false }
  const jar = await headers()
  const here: SessionListItem = { id: "current", label: sessionLabel(jar.get("user-agent") ?? ""), place: placeFromHeaders(jar.get("x-vercel-ip-city"), jar.get("x-vercel-ip-country")), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), current: true }
  const { data, error } = await supabase.from("user_sessions").select("id, auth_session_id, label, place, created_at, last_seen_at").eq("user_id", userId).is("revoked_at", null)
  if (error) return { sessions: [here], managed: false }
  const rows = ((data ?? []) as { id: string; auth_session_id: string; label: string; place: string | null; created_at: string; last_seen_at: string }[]).map((r) => ({ id: r.id, label: r.label, place: r.place, createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.auth_session_id === sessionId }))
  return { sessions: orderSessions(rows.some((r) => r.current) ? rows : [here, ...rows]), managed: true }
}

/** Ends one of the person's own sessions: the database function checks the ownership and removes the session for real. */
export async function endSession(id: string): Promise<{ ok: true } | Fail> {
  const { supabase, userId } = await me()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const { data, error } = await supabase.rpc("revoke_session", { p_id: id })
  return error || data !== true ? { ok: false, error: "Não consegui encerrar essa sessão agora." } : { ok: true }
}

export async function endOtherSessions(): Promise<{ ok: true; ended: number } | Fail> {
  const { supabase, userId, sessionId } = await me()
  if (!userId || !sessionId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const { data, error } = await supabase.rpc("revoke_other_sessions", { p_current: sessionId })
  return error ? { ok: false, error: "Não consegui encerrar as outras sessões agora." } : { ok: true, ended: Number(data ?? 0) }
}
