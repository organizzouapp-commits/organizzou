import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { bypassAuth } from "@/lib/supabase/proxy"

/**
 * A short-lived signed URL for the person's photo, or null (no photo, the bucket or column is not there yet, or any error). Never throws:
 * the app falls back to initials and to the photo kept on this device.
 */
export async function loadAvatarUrl(supabase: unknown, userId: string): Promise<string | null> {
  if (bypassAuth) return null
  try {
    const client = supabase as SupabaseClient
    const { data, error } = await client.from("profiles").select("avatar_path").eq("id", userId).maybeSingle()
    const path = (data as { avatar_path?: string | null } | null)?.avatar_path
    if (error || !path) return null
    const signed = await client.storage.from("avatars").createSignedUrl(path, 3600)
    return signed.data?.signedUrl ?? null
  } catch {
    return null
  }
}
