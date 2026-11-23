import type { SupabaseClient } from "@supabase/supabase-js"

import { invoiceFromRow, subscriptionFromRow } from "@/features/billing/repository"
import type { InvoiceRow, PayMethod, PlanPeriod, SubscriptionRow, SubscriptionStatus } from "@/features/billing/types"

/**
 * Where billing state is kept. The checkout, the status route and the webhook talk to this interface, so they are tested with an in-memory
 * store and run against Supabase (service role: only the server writes billing rows) in production.
 */

export type NewSubscription = { userId: string; asaasSubscriptionId: string; planPeriod: PlanPeriod; method: PayMethod; status: SubscriptionStatus }
export type SubscriptionPatch = Partial<{ planPeriod: PlanPeriod; method: PayMethod; status: SubscriptionStatus; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; graceUntil: string | null }>
export type InvoiceRecord = InvoiceRow & { userId: string; asaasSubscriptionId: string | null }

export interface BillingStore {
  getCustomer(userId: string): Promise<{ asaasCustomerId: string; cpfCnpj: string } | null>
  saveCustomer(userId: string, asaasCustomerId: string, cpfCnpj: string): Promise<void>
  latestSubscription(userId: string): Promise<SubscriptionRow | null>
  subscriptionByAsaasId(asaasSubscriptionId: string): Promise<SubscriptionRow | null>
  insertSubscription(input: NewSubscription): Promise<SubscriptionRow>
  patchSubscription(id: string, patch: SubscriptionPatch): Promise<void>
  hasPaidInvoice(userId: string): Promise<boolean>
  upsertInvoice(invoice: Omit<InvoiceRecord, "id">): Promise<void>
  invoiceByAsaasPaymentId(asaasPaymentId: string): Promise<InvoiceRecord | null>
  listInvoices(userId: string, limit?: number): Promise<InvoiceRow[]>
  getProfilePlan(userId: string): Promise<{ plan: string | null; planUntil: string | null }>
  setProfilePlan(userId: string, plan: { plan: "free" | "pro"; planUntil: string | null }): Promise<void>
  /**
   * "new": first time (now recorded). "duplicate": already received and processed. "retry": received before but never finished
   * (the processing failed), so it must be processed again.
   */
  recordEvent(event: { id: string; event: string; paymentId: string | null; payload: Record<string, unknown> }): Promise<"new" | "duplicate" | "retry">
  markEventProcessed(id: string): Promise<void>
  /**
   * A subscription we could not delete at Asaas after a failed checkout: kept in billing_events (event ORPHAN_SUBSCRIPTION, processed_at
   * empty while it is open) so it can be cleaned later. No migration needed. Only the Asaas id and our internal user id are stored.
   */
  recordOrphan(asaasSubscriptionId: string, userId: string): Promise<void>
  openOrphans(userId?: string): Promise<OrphanRecord[]>
  resolveOrphan(asaasSubscriptionId: string): Promise<void>
}

export type OrphanRecord = { asaasSubscriptionId: string; userId: string | null; createdAt: string }
export const ORPHAN_EVENT = "ORPHAN_SUBSCRIPTION"

class StoreError extends Error {}
const must = (error: { message?: string } | null) => {
  if (error) throw new StoreError("billing store")
}

const patchToRow = (p: SubscriptionPatch) => ({
  ...(p.planPeriod !== undefined && { plan_period: p.planPeriod }),
  ...(p.method !== undefined && { method: p.method }),
  ...(p.status !== undefined && { status: p.status }),
  ...(p.currentPeriodEnd !== undefined && { current_period_end: p.currentPeriodEnd }),
  ...(p.cancelAtPeriodEnd !== undefined && { cancel_at_period_end: p.cancelAtPeriodEnd }),
  ...(p.graceUntil !== undefined && { grace_until: p.graceUntil }),
  updated_at: new Date().toISOString(),
})

/** Supabase implementation. Pass the SECRET-key client: these tables accept writes only from the service role. */
export function supabaseBillingStore(db: SupabaseClient): BillingStore {
  return {
    async getCustomer(userId) {
      const { data, error } = await db.from("billing_customers").select("asaas_customer_id, cpf_cnpj").eq("user_id", userId).maybeSingle()
      must(error)
      const row = data as { asaas_customer_id: string; cpf_cnpj: string } | null
      return row ? { asaasCustomerId: row.asaas_customer_id, cpfCnpj: row.cpf_cnpj } : null
    },
    async saveCustomer(userId, asaasCustomerId, cpfCnpj) {
      const { error } = await db.from("billing_customers").upsert({ user_id: userId, asaas_customer_id: asaasCustomerId, cpf_cnpj: cpfCnpj }, { onConflict: "user_id" })
      must(error)
    },
    async latestSubscription(userId) {
      const { data, error } = await db.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1)
      must(error)
      const row = (data as Record<string, unknown>[] | null)?.[0]
      return row ? subscriptionFromRow(row) : null
    },
    async subscriptionByAsaasId(asaasSubscriptionId) {
      const { data, error } = await db.from("subscriptions").select("*").eq("asaas_subscription_id", asaasSubscriptionId).maybeSingle()
      must(error)
      return data ? subscriptionFromRow(data as Record<string, unknown>) : null
    },
    async insertSubscription(input) {
      const { data, error } = await db
        .from("subscriptions")
        .insert({ user_id: input.userId, asaas_subscription_id: input.asaasSubscriptionId, plan_period: input.planPeriod, method: input.method, status: input.status })
        .select("*")
        .single()
      must(error)
      return subscriptionFromRow(data as Record<string, unknown>)
    },
    async patchSubscription(id, patch) {
      const { error } = await db.from("subscriptions").update(patchToRow(patch)).eq("id", id)
      must(error)
    },
    async hasPaidInvoice(userId) {
      const { count, error } = await db.from("billing_invoices").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"])
      must(error)
      return (count ?? 0) > 0
    },
    async upsertInvoice(inv) {
      const { error } = await db.from("billing_invoices").upsert(
        {
          user_id: inv.userId,
          asaas_payment_id: inv.asaasPaymentId,
          asaas_subscription_id: inv.asaasSubscriptionId,
          amount_cents: inv.amountCents,
          status: inv.status,
          method: inv.method,
          due_date: inv.dueDate,
          paid_at: inv.paidAt,
          invoice_url: inv.invoiceUrl,
          description: inv.description,
        },
        { onConflict: "asaas_payment_id" }
      )
      must(error)
    },
    async invoiceByAsaasPaymentId(asaasPaymentId) {
      const { data, error } = await db.from("billing_invoices").select("*").eq("asaas_payment_id", asaasPaymentId).maybeSingle()
      must(error)
      const row = data as Record<string, unknown> | null
      return row ? { ...invoiceFromRow(row), userId: String(row.user_id), asaasSubscriptionId: typeof row.asaas_subscription_id === "string" ? row.asaas_subscription_id : null } : null
    },
    async listInvoices(userId, limit = 24) {
      const { data, error } = await db.from("billing_invoices").select("*").eq("user_id", userId).order("due_date", { ascending: false }).limit(limit)
      must(error)
      return ((data as Record<string, unknown>[] | null) ?? []).map(invoiceFromRow)
    },
    async getProfilePlan(userId) {
      const { data, error } = await db.from("profiles").select("plan, plan_until").eq("id", userId).maybeSingle()
      must(error)
      const row = data as { plan: string | null; plan_until: string | null } | null
      return { plan: row?.plan ?? null, planUntil: row?.plan_until ?? null }
    },
    async setProfilePlan(userId, { plan, planUntil }) {
      const { error } = await db.from("profiles").update({ plan, plan_until: planUntil }).eq("id", userId)
      must(error)
    },
    async recordEvent(event) {
      const { error } = await db.from("billing_events").insert({ asaas_event_id: event.id, event: event.event, asaas_payment_id: event.paymentId, payload: event.payload })
      if (!error) return "new"
      // 23505 = unique violation: this event id was already received. Processed or not?
      if ((error as { code?: string }).code !== "23505") throw new StoreError("billing store")
      const { data, error: readError } = await db.from("billing_events").select("processed_at").eq("asaas_event_id", event.id).maybeSingle()
      must(readError)
      return (data as { processed_at: string | null } | null)?.processed_at ? "duplicate" : "retry"
    },
    async markEventProcessed(id) {
      const { error } = await db.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("asaas_event_id", id)
      must(error)
    },
    async recordOrphan(asaasSubscriptionId, userId) {
      const { error } = await db.from("billing_events").insert({ asaas_event_id: `orphan:${asaasSubscriptionId}`, event: ORPHAN_EVENT, payload: { subscription: asaasSubscriptionId, user_id: userId } })
      // 23505: already recorded.
      if (error && (error as { code?: string }).code !== "23505") throw new StoreError("billing store")
    },
    async openOrphans(userId) {
      let query = db.from("billing_events").select("payload, created_at").eq("event", ORPHAN_EVENT).is("processed_at", null)
      if (userId) query = query.eq("payload->>user_id", userId)
      const { data, error } = await query.order("created_at", { ascending: false }).limit(50)
      must(error)
      return ((data as { payload: { subscription?: string; user_id?: string | null }; created_at: string }[] | null) ?? [])
        .filter((row) => typeof row.payload?.subscription === "string")
        .map((row) => ({ asaasSubscriptionId: row.payload.subscription as string, userId: row.payload.user_id ?? null, createdAt: row.created_at }))
    },
    async resolveOrphan(asaasSubscriptionId) {
      const { error } = await db.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("asaas_event_id", `orphan:${asaasSubscriptionId}`)
      must(error)
    },
  }
}
