"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

import { avatarPath, MAX_UPLOAD_BYTES } from "@/features/settings/avatar"
import { createClient } from "@/lib/supabase/server"

type SaveResult = { ok: true; url: string | null } | { ok: false; error: string }
type RemoveResult = { ok: true } | { ok: false; error: string }

const FAIL = "Não consegui salvar a foto agora. Ela ficou guardada só neste aparelho."

async function session() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return { supabase: supabase as unknown as SupabaseClient, userId: data?.claims?.sub ?? null }
}

/** Saves the already cropped webp (512x512) in the person's own folder of the "avatars" bucket and points the profile at it. */
export async function saveAvatar(formData: FormData): Promise<SaveResult> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.type !== "image/webp") return { ok: false, error: "Foto inválida." }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "A foto é grande demais." }
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  const path = avatarPath(userId)
  const upload = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: "image/webp", cacheControl: "3600" })
  if (upload.error) return { ok: false, error: FAIL }
  const update = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId)
  if (update.error) return { ok: false, error: FAIL }
  const signed = await supabase.storage.from("avatars").createSignedUrl(path, 3600)
  revalidatePath("/", "layout")
  return { ok: true, url: signed.data?.signedUrl ?? null }
}

export async function removeAvatar(): Promise<RemoveResult> {
  const { supabase, userId } = await session()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }
  await supabase.storage.from("avatars").remove([avatarPath(userId)])
  const update = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId)
  if (update.error) return { ok: false, error: "Não consegui remover a foto agora." }
  revalidatePath("/", "layout")
  return { ok: true }
}
