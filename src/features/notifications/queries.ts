import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { AppNotification } from "./types"

/**
 * The latest notifications of the signed-in person (their own, through their session). A table that is not there yet (the
 * migration is pending) or any read error gives an empty list: the bell then says there is nothing new, which is true to what it can show.
 */
export async function getNotifications(supabase: SupabaseClient, limit = 20): Promise<AppNotification[]> {
  const { data, error } = await supabase.from("notifications").select("id, kind, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(limit)
  if (error) return []
  return (data ?? []) as AppNotification[]
}
