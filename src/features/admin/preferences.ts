"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdminForAction } from "@/lib/admin/guard"

export type PreferenceResult = { ok: true; message: string } | { ok: false; error: string }
const fail = (error: string): PreferenceResult => ({ ok: false, error })

/**
 * "Incluir contas de teste": each admin chooses, for themselves, whether the numbers count the demo/test accounts (default: no).
 * Saved with the admin's OWN session (RLS: only their own row, and only while they are an admin), read back before saying yes.
 */
export async function setIncludeTestAccounts(input: { include: boolean }): Promise<PreferenceResult> {
  const parsed = z.object({ include: z.boolean() }).safeParse(input)
  if (!parsed.success) return fail("Dados inválidos.")
  const admin = await requireAdminForAction()
  const { error } = await admin.supabase.from("admin_preferences").upsert({ admin_id: admin.adminId, include_test: parsed.data.include }, { onConflict: "admin_id" })
  if (error) return fail("Não consegui salvar essa preferência. A migration das contas de teste já foi aplicada?")
  const check = await admin.supabase.from("admin_preferences").select("include_test").eq("admin_id", admin.adminId).maybeSingle()
  if ((check.data as { include_test?: boolean } | null)?.include_test !== parsed.data.include) return fail("O banco não guardou a preferência.")
  revalidatePath("/admin", "layout")
  return { ok: true, message: parsed.data.include ? "Contas de teste incluídas nos números." : "Contas de teste fora dos números." }
}
