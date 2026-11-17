import type { BillingSnapshot, InvoiceRow, SubscriptionRow } from "./types"
import { EMPTY_BILLING } from "./types"

/** Reads what the person may see of their billing. Missing tables or any error mean "no billing yet", that is, the Free plan. */
export interface BillingRepository {
  load(): Promise<BillingSnapshot>
}

type Db = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }> }
    }
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : null)

export function subscriptionFromRow(r: Record<string, unknown>): SubscriptionRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    asaasSubscriptionId: str(r.asaas_subscription_id),
    planPeriod: r.plan_period === "annual" ? "annual" : "monthly",
    method: r.method === "pix" || r.method === "boleto" ? r.method : "card",
    status: (["pending", "active", "overdue", "canceled", "ended"].includes(String(r.status)) ? r.status : "pending") as SubscriptionRow["status"],
    currentPeriodEnd: str(r.current_period_end),
    cancelAtPeriodEnd: r.cancel_at_period_end === true,
    graceUntil: str(r.grace_until),
    createdAt: str(r.created_at) ?? new Date(0).toISOString(),
  }
}

export function invoiceFromRow(r: Record<string, unknown>): InvoiceRow {
  return {
    id: String(r.id),
    asaasPaymentId: String(r.asaas_payment_id),
    amountCents: Number(r.amount_cents) || 0,
    status: String(r.status ?? ""),
    method: str(r.method),
    dueDate: str(r.due_date),
    paidAt: str(r.paid_at),
    invoiceUrl: str(r.invoice_url),
    description: str(r.description),
  }
}

/** Supabase implementation (RLS lets a person read only their own rows). */
export function supabaseBillingRepository(supabase: unknown): BillingRepository {
  const db = supabase as Db
  return {
    async load() {
      try {
        const [subs, invoices] = await Promise.all([
          db.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(1),
          db.from("billing_invoices").select("*").order("due_date", { ascending: false }).limit(24),
        ])
        if (subs.error) return EMPTY_BILLING
        const sub = (subs.data as Record<string, unknown>[] | null)?.[0]
        return {
          subscription: sub ? subscriptionFromRow(sub) : null,
          invoices: invoices.error ? [] : ((invoices.data as Record<string, unknown>[] | null) ?? []).map(invoiceFromRow),
        }
      } catch {
        return EMPTY_BILLING
      }
    },
  }
}

const LOCAL_KEY = "organizzou.billing"

/** localStorage fallback: nothing is ever charged from the device, so it only remembers a snapshot to keep the screen readable offline. */
export function localBillingRepository(storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage): BillingRepository {
  return {
    async load() {
      try {
        const raw = storage?.getItem(LOCAL_KEY)
        if (!raw) return EMPTY_BILLING
        const parsed = JSON.parse(raw) as Partial<BillingSnapshot>
        return { subscription: parsed.subscription ?? null, invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [] }
      } catch {
        return EMPTY_BILLING
      }
    },
  }
}

/** Server repository first; when it has nothing (tables missing), the local one. Absence is Free. */
export async function loadBilling(primary: BillingRepository, fallback: BillingRepository = localBillingRepository()): Promise<BillingSnapshot> {
  const main = await primary.load()
  if (main.subscription || main.invoices.length > 0) return main
  return fallback.load()
}
