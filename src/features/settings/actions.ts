"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { toE164 } from "@/features/auth/schemas"
import { createClient } from "@/lib/supabase/server"

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Informe seu nome.").max(80, "Use no máximo 80 caracteres."),
  /** Brazilian number as typed ("(11) 91234-5678"); empty clears it. */
  phone: z.string().trim().default(""),
})

const themeSchema = z.enum(["dark", "light"])

type Result = { ok: true } | { ok: false; error: string }

const SAVE_ERROR = "Não consegui salvar. Verifique a conexão e tente de novo."

async function currentUserId() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: data?.claims?.sub ?? null }
}

export async function updateProfile(input: { displayName: string; phone?: string }): Promise<Result> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  let phone: string | null = null
  if (parsed.data.phone) {
    phone = toE164(parsed.data.phone)
    if (!phone) return { ok: false, error: "Informe um telefone válido com DDD." }
  }

  const { supabase, userId } = await currentUserId()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }

  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.displayName, phone }).eq("id", userId)
  if (error) return { ok: false, error: error.code === "23505" ? "Esse telefone já está em uso por outra conta." : SAVE_ERROR }

  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateTheme(theme: string): Promise<Result> {
  const parsed = themeSchema.safeParse(theme)
  if (!parsed.success) return { ok: false, error: SAVE_ERROR }

  const { supabase, userId } = await currentUserId()
  if (!userId) return { ok: false, error: "Sua sessão expirou. Entre de novo." }

  const { error } = await supabase.from("profiles").update({ theme: parsed.data }).eq("id", userId)
  if (error) return { ok: false, error: SAVE_ERROR }

  return { ok: true }
}
