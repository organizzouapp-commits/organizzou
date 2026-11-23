import "server-only"

import { LAUNCH_PRICE_CENTS } from "@/lib/plans"
import { PAID_STATUSES } from "@/lib/billing/store"

import { createSecretClient, SECRET_KEY_HINT, secretKeyConfigured } from "./secret"
import { requireAdmin } from "./guard"

/**
 * Extra readers for Admin > Assinaturas that the SQL reader (admin.billing_by_user) does not give: who is Pro by hand, with no subscription.
 * They run with the secret key AFTER the admin check, and read account state only (ids, plan, dates): no content, no documents.
 */

export type ManualPro = { userId: string; email: string; planUntil: string | null }
export type Extra<T> = { ok: true; data: T } | { ok: false; error: string }

const LIVE = ["pending", "active", "overdue"]
/** Which of these accounts paid the launch price (a paid invoice of at most that amount). Ids only in, ids only out. */
export async function launchPriceUsers(userIds: string[]): Promise<Extra<Set<string>>> {
  await requireAdmin()
  if (userIds.length === 0) return { ok: true, data: new Set() }
  if (!secretKeyConfigured()) return { ok: false, error: SECRET_KEY_HINT }
  try {
    const { data, error } = await createSecretClient()
      .from("billing_invoices")
      .select("user_id")
      .in("user_id", userIds)
      .lte("amount_cents", LAUNCH_PRICE_CENTS)
      .or(`status.in.(${PAID_STATUSES.join(",")}),paid_at.not.is.null`)
    if (error) return { ok: false, error: "Não consegui ler as faturas." }
    return { ok: true, data: new Set(((data as { user_id: string }[] | null) ?? []).map((r) => r.user_id)) }
  } catch {
    return { ok: false, error: "Não consegui ler as faturas." }
  }
}


/** Pro accounts that have no live subscription: granted by an admin (a courtesy or an open-ended Pro). Pure, so it is tested. */
export function splitManual<T extends { id: string }>(pros: T[], liveSubscriptionUserIds: Iterable<string>): T[] {
  const live = new Set(liveSubscriptionUserIds)
  return pros.filter((p) => !live.has(p.id))
}

export async function manualProAccounts(limit = 50): Promise<Extra<ManualPro[]>> {
  await requireAdmin()
  if (!secretKeyConfigured()) return { ok: false, error: SECRET_KEY_HINT }
  try {
    const secret = createSecretClient()
    const now = new Date().toISOString()
    const pros = await secret.from("profiles").select("id, plan_until").eq("plan", "pro").or(`plan_until.is.null,plan_until.gt.${now}`).limit(500)
    if (pros.error) return { ok: false, error: "Não consegui ler os planos." }
    // Without the billing tables there are no subscriptions at all: every Pro is manual.
    const subs = await secret.from("subscriptions").select("user_id").in("status", LIVE)
    const live = subs.error ? [] : ((subs.data as { user_id: string }[] | null) ?? []).map((s) => s.user_id)
    const manual = splitManual((pros.data as { id: string; plan_until: string | null }[] | null) ?? [], live).slice(0, limit)
    const rows = await Promise.all(
      manual.map(async (p) => {
        const user = await secret.auth.admin.getUserById(p.id)
        return { userId: p.id, email: user.data.user?.email ?? "", planUntil: p.plan_until }
      })
    )
    return { ok: true, data: rows.filter((r) => r.email) }
  } catch {
    return { ok: false, error: "Não consegui ler as contas com Pro manual." }
  }
}
