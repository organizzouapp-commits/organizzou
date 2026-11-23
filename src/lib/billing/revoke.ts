import type { AsaasClient } from "./asaas"
import { deleteSubscriptionReliably } from "./service"
import type { BillingStore } from "./store"

/**
 * Ends the paid subscription of a person BEFORE an admin sets their plan back to Free. Going back to Free while the subscription lives would
 * leave Asaas charging them (and the next payment would turn Pro on again), so the order is: cancel at Asaas (three attempts, "not found" is
 * success), mark our row ended, and only then the plan changes. If Asaas cannot be reached nothing is changed, and the admin is told so.
 */

export type RevokeResult = { ok: true; ended: boolean; subscriptionId: string | null } | { ok: false; error: string }

const LIVE = new Set(["pending", "active", "overdue"])

export async function endSubscriptionForRevoke(deps: { asaas: Pick<AsaasClient, "deleteSubscription"> | null; store: BillingStore; sleep?: (ms: number) => Promise<void> }, userId: string): Promise<RevokeResult> {
  let sub
  try {
    sub = await deps.store.latestSubscription(userId)
  } catch {
    // The billing tables are not there (their migration is not applied): there is no subscription to end.
    return { ok: true, ended: false, subscriptionId: null }
  }
  if (!sub || !LIVE.has(sub.status)) return { ok: true, ended: false, subscriptionId: null }

  if (sub.asaasSubscriptionId) {
    if (!deps.asaas) return { ok: false, error: "Esta pessoa tem uma assinatura no Asaas e o Asaas não está configurado aqui (ASAAS_API_KEY). Nada foi alterado: cancele a assinatura no painel do Asaas e tente de novo." }
    const result = await deleteSubscriptionReliably(deps.asaas, sub.asaasSubscriptionId, deps.sleep)
    if (!result.ok) return { ok: false, error: `O Asaas não aceitou cancelar a assinatura (status ${result.status || "sem resposta"}). Nada foi alterado: o plano e a assinatura continuam como estavam. Tente de novo ou cancele no painel do Asaas.` }
  }
  try {
    await deps.store.patchSubscription(sub.id, { status: "ended", cancelAtPeriodEnd: true, graceUntil: null })
  } catch {
    return { ok: false, error: "A assinatura foi cancelada no Asaas, mas não consegui marcá-la como encerrada no nosso banco. O plano NÃO foi alterado: tente de novo." }
  }
  return { ok: true, ended: true, subscriptionId: sub.asaasSubscriptionId }
}
