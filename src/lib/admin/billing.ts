/**
 * Payments are NOT built (docs/INTEGRATIONS-STATUS.md): there is no provider, no invoice and no card data anywhere. This is the
 * typed seam where one plugs in later. While `billingProvider` is null the page shows "Em breve" placeholders, never numbers.
 *
 * To connect a provider: implement `BillingProvider` (e.g. in src/lib/admin/billing-stripe.ts) and export it as `billingProvider`.
 */

export type Invoice = {
  id: string
  userId: string
  /** Amount in BRL cents. */
  amountCents: number
  status: "paid" | "open" | "void"
  issuedAt: string
}

export type FailedPayment = {
  id: string
  userId: string
  amountCents: number
  reason: string
  failedAt: string
}

export type BillingMetrics = {
  /** Monthly recurring revenue, BRL cents. */
  mrrCents: number
  /** Share of paying customers lost in the last 30 days, 0..1. */
  monthlyChurn: number
  invoices: Invoice[]
  failedPayments: FailedPayment[]
}

export interface BillingProvider {
  /** Shown on the page, e.g. "Stripe". */
  readonly name: string
  getMetrics(): Promise<BillingMetrics>
}

/** No provider yet. */
export const billingProvider: BillingProvider | null = null
