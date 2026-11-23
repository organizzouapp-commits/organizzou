"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logAdminAction } from "@/lib/admin/audit"
import { requireAdminForAction } from "@/lib/admin/guard"
import { createSecretClient, SECRET_KEY_HINT, secretKeyConfigured } from "@/lib/admin/secret"
import { asaasFromEnv } from "@/lib/billing/asaas"
import { deleteSubscriptionReliably } from "@/lib/billing/service"
import { supabaseBillingStore } from "@/lib/billing/store"

export type OrphanResult = { ok: true; message: string } | { ok: false; error: string }

const input = z.object({ subscription: z.string().regex(/^[A-Za-z0-9_-]{4,64}$/) })

/**
 * "Tentar apagar de novo": deletes an orphan subscription at Asaas (three attempts, "not found" is success), closes the record and writes the
 * audit entry. Admin only, re-checked on the server (token and database) before anything is read or written.
 */
export async function retryOrphanCleanup(raw: z.input<typeof input>): Promise<OrphanResult> {
  const admin = await requireAdminForAction()
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "Assinatura inválida." }
  if (!secretKeyConfigured()) return { ok: false, error: SECRET_KEY_HINT }
  const asaas = asaasFromEnv()
  if (!asaas) return { ok: false, error: "O Asaas não está configurado neste ambiente (ASAAS_API_KEY)." }

  const secret = createSecretClient()
  const store = supabaseBillingStore(secret)
  // Only a recorded orphan can be deleted from here: the action never takes an arbitrary Asaas id.
  const open = await store.openOrphans().catch(() => null)
  if (!open) return { ok: false, error: "Não consegui ler a lista agora. Tente de novo." }
  if (!open.some((o) => o.asaasSubscriptionId === parsed.data.subscription)) return { ok: false, error: "Essa assinatura não está na lista de pendentes." }

  const result = await deleteSubscriptionReliably(asaas, parsed.data.subscription)
  if (!result.ok) return { ok: false, error: `O Asaas ainda não aceitou apagar (status ${result.status || "sem resposta"}). Apague pelo painel do Asaas e tente de novo.` }
  await store.resolveOrphan(parsed.data.subscription)
  const logged = await logAdminAction(secret, { adminId: admin.adminId, adminEmail: admin.email, action: "billing.orphan_cleanup", payload: { subscription: parsed.data.subscription } })
  revalidatePath("/admin/assinaturas")
  return logged.ok ? { ok: true, message: "Assinatura apagada no Asaas." } : { ok: false, error: "Apagou no Asaas, mas o registro de auditoria falhou. Avise quem cuida do servidor." }
}
