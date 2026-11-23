import "server-only"

import { supabaseBillingStore, type OrphanRecord } from "@/lib/billing/store"

import { requireAdmin } from "./guard"
import { createSecretClient, SECRET_KEY_HINT, secretKeyConfigured } from "./secret"

/**
 * Subscriptions a failed checkout could not delete at Asaas (see cleanUpSubscription). They live in billing_events, which no browser role can read,
 * so the admin page reads them with the secret key AFTER the admin check. Only the Asaas id and our internal user id exist in the record.
 */
export async function openOrphanSubscriptions(): Promise<{ ok: true; data: OrphanRecord[] } | { ok: false; error: string }> {
  await requireAdmin()
  if (!secretKeyConfigured()) return { ok: false, error: SECRET_KEY_HINT }
  try {
    return { ok: true, data: await supabaseBillingStore(createSecretClient()).openOrphans() }
  } catch {
    return { ok: false, error: "Não consegui ler as assinaturas pendentes de limpeza (a migration das cobranças foi aplicada?)." }
  }
}
