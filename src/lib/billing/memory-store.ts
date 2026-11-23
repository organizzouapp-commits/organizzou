import type { SubscriptionRow } from "@/features/billing/types"

import { type BillingStore, type InvoiceRecord, type OrphanRecord, PAID_STATUSES } from "./store"

/** An in-memory BillingStore, for tests only. */
export function memoryBillingStore() {
  const customers = new Map<string, { asaasCustomerId: string; cpfCnpj: string }>()
  const subscriptions: SubscriptionRow[] = []
  const invoices: InvoiceRecord[] = []
  const profiles = new Map<string, { plan: string | null; planUntil: string | null }>()
  const events = new Map<string, { processed: boolean; event: string }>()
  const orphans: (OrphanRecord & { open: boolean })[] = []
  let seq = 0

  const store: BillingStore = {
    getCustomer: async (userId) => customers.get(userId) ?? null,
    saveCustomer: async (userId, asaasCustomerId, cpfCnpj) => void customers.set(userId, { asaasCustomerId, cpfCnpj }),
    latestSubscription: async (userId) => [...subscriptions].filter((s) => s.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    subscriptionByAsaasId: async (id) => subscriptions.find((s) => s.asaasSubscriptionId === id) ?? null,
    insertSubscription: async (input) => {
      const row: SubscriptionRow = { id: `sub-${++seq}`, userId: input.userId, asaasSubscriptionId: input.asaasSubscriptionId, planPeriod: input.planPeriod, method: input.method, status: input.status, currentPeriodEnd: null, cancelAtPeriodEnd: false, graceUntil: null, createdAt: new Date(2026, 0, 1, 0, 0, seq).toISOString() }
      subscriptions.push(row)
      return row
    },
    patchSubscription: async (id, patch) => {
      const i = subscriptions.findIndex((s) => s.id === id)
      if (i >= 0) subscriptions[i] = { ...subscriptions[i], ...patch }
    },
    hasPaidInvoice: async (userId) => invoices.some((i) => i.userId === userId && ((PAID_STATUSES as readonly string[]).includes(i.status) || i.paidAt !== null)),
    upsertInvoice: async (inv) => {
      const i = invoices.findIndex((x) => x.asaasPaymentId === inv.asaasPaymentId)
      if (i >= 0) invoices[i] = { ...invoices[i], ...inv }
      else invoices.push({ id: `inv-${++seq}`, ...inv })
    },
    invoiceByAsaasPaymentId: async (id) => invoices.find((i) => i.asaasPaymentId === id) ?? null,
    listInvoices: async (userId) => invoices.filter((i) => i.userId === userId).sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? "")),
    getProfilePlan: async (userId) => profiles.get(userId) ?? { plan: null, planUntil: null },
    setProfilePlan: async (userId, { plan, planUntil }) => void profiles.set(userId, { plan, planUntil }),
    recordEvent: async (e) => {
      const seen = events.get(e.id)
      if (seen) return seen.processed ? "duplicate" : "retry"
      events.set(e.id, { processed: false, event: e.event })
      return "new"
    },
    markEventProcessed: async (id) => void (events.get(id)!.processed = true),
    recordOrphan: async (asaasSubscriptionId, userId) => {
      if (!orphans.some((o) => o.asaasSubscriptionId === asaasSubscriptionId)) orphans.push({ asaasSubscriptionId, userId, createdAt: new Date().toISOString(), open: true })
    },
    openOrphans: async (userId) => orphans.filter((o) => o.open && (!userId || o.userId === userId)),
    resolveOrphan: async (asaasSubscriptionId) => {
      const o = orphans.find((x) => x.asaasSubscriptionId === asaasSubscriptionId)
      if (o) o.open = false
    },
  }
  return { store, customers, subscriptions, invoices, profiles, events, orphans }
}
