"use server"

import { revalidatePath } from "next/cache"

import { logAdminAction } from "@/lib/admin/audit"
import { parseBudget } from "@/lib/admin/assistant-cost"
import { requireAdminForAction } from "@/lib/admin/guard"
import { createSecretClient, SECRET_KEY_HINT, secretKeyConfigured } from "@/lib/admin/secret"

import type { AdminActionResult } from "./actions"

const KEY = "assistant_monthly_budget_usd"

/**
 * Saves (or removes, with an empty value) the monthly assistant budget in US$. Admin only: the guard re-checks the JWT AND the database
 * before anything is read or written, so hiding the form is never what protects it. The budget only informs: it blocks nobody.
 */
export async function saveAssistantBudget(input: { usd: string | null }): Promise<AdminActionResult> {
  const admin = await requireAdminForAction()
  if (!secretKeyConfigured()) return { ok: false, error: SECRET_KEY_HINT }

  const raw = (input?.usd ?? "").toString().trim()
  const usd = raw === "" ? null : parseBudget(raw)
  if (raw !== "" && usd == null) return { ok: false, error: "Informe um valor em dólares maior que zero (por exemplo 20 ou 12,50)." }

  const secret = createSecretClient()
  const written = usd == null ? await secret.from("admin_settings").delete().eq("key", KEY) : await secret.from("admin_settings").upsert({ key: KEY, value: usd, updated_at: new Date().toISOString(), updated_by: admin.adminId }, { onConflict: "key" })
  if (written.error) {
    const missing = written.error.code === "42P01" || written.error.code === "PGRST205"
    return { ok: false, error: missing ? "Falta aplicar a migração 20261117000001_admin_assistant_cost.sql no banco." : "Não consegui guardar o orçamento agora." }
  }
  const logged = await logAdminAction(secret, { adminId: admin.adminId, adminEmail: admin.email, action: "assistant.budget", payload: { usd } })
  revalidatePath("/admin", "layout")
  if (!logged.ok) return { ok: false, error: "O orçamento foi guardado, mas o registro de auditoria falhou. Avise quem cuida do servidor." }
  return { ok: true, message: usd == null ? "Orçamento removido." : "Orçamento mensal guardado." }
}
