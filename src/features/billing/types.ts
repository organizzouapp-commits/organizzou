export type PlanPeriod = "monthly" | "annual"
export type PayMethod = "card" | "pix" | "boleto"
export type SubscriptionStatus = "pending" | "active" | "overdue" | "canceled" | "ended"

export type SubscriptionRow = {
  id: string
  userId: string
  asaasSubscriptionId: string | null
  planPeriod: PlanPeriod
  method: PayMethod
  status: SubscriptionStatus
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  graceUntil: string | null
  createdAt: string
}

export type InvoiceRow = {
  id: string
  asaasPaymentId: string
  amountCents: number
  status: string
  method: string | null
  dueDate: string | null
  paidAt: string | null
  invoiceUrl: string | null
  description: string | null
}

/** What the plan screen needs. Absence of data is the Free plan. */
export type BillingSnapshot = {
  subscription: SubscriptionRow | null
  invoices: InvoiceRow[]
}

export const EMPTY_BILLING: BillingSnapshot = { subscription: null, invoices: [] }
