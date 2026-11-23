import { createHash, timingSafeEqual } from "node:crypto"

import { GRACE_DAYS } from "@/lib/plans"

import { fromAsaasValue, periodEnd } from "./pricing"
import type { AsaasClient } from "./asaas"
import { methodOf } from "./service"
import type { BillingStore } from "./store"

/**
 * Asaas webhooks. The handler is idempotent (billing_events keeps every event id), tolerant (an event for something we do not know is
 * recorded and ignored, never an error) and quiet: it logs and answers nothing about the inside.
 */

/** Constant-time comparison of the `asaas-access-token` header with ASAAS_WEBHOOK_TOKEN (both hashed first, so the lengths do not leak). */
export function tokenMatches(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected) return false
  const a = createHash("sha256").update(received).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

type PaymentPayload = {
  id?: string
  status?: string
  value?: number
  dueDate?: string
  billingType?: string
  subscription?: string | null
  invoiceUrl?: string | null
  bankSlipUrl?: string | null
  paymentDate?: string | null
  confirmedDate?: string | null
  clientPaymentDate?: string | null
  description?: string | null
}
export type WebhookPayload = { id?: string; event?: string; payment?: PaymentPayload; subscription?: { id?: string; status?: string } }

export type HandleResult = { handled: "ok" | "duplicate" | "ignored" | "invalid" }

const DAY = 86_400_000
/** The paid period ends at the end of that day in São Paulo. */
const endOfDay = (day: string) => `${day}T23:59:59-03:00`

/** Only what the handler needs is kept in billing_events (no card, no name, no document). */
const minimal = (p: WebhookPayload) => ({ event: p.event, payment: p.payment ? { id: p.payment.id, status: p.payment.status, value: p.payment.value, dueDate: p.payment.dueDate, subscription: p.payment.subscription, billingType: p.payment.billingType } : undefined, subscription: p.subscription ? { id: p.subscription.id, status: p.subscription.status } : undefined })

export async function handleWebhook(store: BillingStore, payload: WebhookPayload, now: Date = new Date()): Promise<HandleResult> {
  if (!payload || typeof payload.id !== "string" || typeof payload.event !== "string") return { handled: "invalid" }
  const state = await store.recordEvent({ id: payload.id, event: payload.event, paymentId: payload.payment?.id ?? null, payload: minimal(payload) })
  if (state === "duplicate") return { handled: "duplicate" }

  const result = await process(store, payload, now)
  await store.markEventProcessed(payload.id)
  return { handled: result }
}

async function process(store: BillingStore, p: WebhookPayload, now: Date): Promise<"ok" | "ignored"> {
  const event = p.event as string

  if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
    const sub = p.subscription?.id ? await store.subscriptionByAsaasId(p.subscription.id) : null
    if (!sub) return "ignored"
    // The recurrence ends; what was paid stays: Pro runs until plan_until (nothing is cut short, nothing is deleted).
    await store.patchSubscription(sub.id, sub.status === "pending" ? { status: "canceled", cancelAtPeriodEnd: true } : { cancelAtPeriodEnd: true })
    return "ok"
  }

  const payment = p.payment
  if (!payment?.id || !event.startsWith("PAYMENT_")) return "ignored"
  const existing = await store.invoiceByAsaasPaymentId(payment.id)
  const sub = payment.subscription ? await store.subscriptionByAsaasId(payment.subscription) : existing?.asaasSubscriptionId ? await store.subscriptionByAsaasId(existing.asaasSubscriptionId) : null
  const userId = existing?.userId ?? sub?.userId
  if (!userId) return "ignored"

  const upsert = (status: string, paidAt: string | null = existing?.paidAt ?? null) =>
    store.upsertInvoice({
      userId,
      asaasSubscriptionId: payment.subscription ?? existing?.asaasSubscriptionId ?? null,
      asaasPaymentId: payment.id!,
      amountCents: payment.value !== undefined ? fromAsaasValue(payment.value) : (existing?.amountCents ?? 0),
      status,
      method: methodOf(payment.billingType) ?? existing?.method ?? sub?.method ?? null,
      dueDate: payment.dueDate ?? existing?.dueDate ?? null,
      paidAt,
      invoiceUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? existing?.invoiceUrl ?? null,
      description: payment.description ?? existing?.description ?? null,
    })

  switch (event) {
    case "PAYMENT_CREATED":
    case "PAYMENT_UPDATED":
      // Renewal charges show up in the invoice list as soon as Asaas creates them. A paid one is never taken back to pending.
      if (existing && ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(existing.status)) return "ok"
      await upsert(payment.status ?? "PENDING")
      return "ok"

    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      const paidAt = payment.paymentDate ?? payment.confirmedDate ?? payment.clientPaymentDate
      await upsert(event === "PAYMENT_RECEIVED" ? "RECEIVED" : "CONFIRMED", paidAt ? `${paidAt.slice(0, 10)}T12:00:00Z` : now.toISOString())
      if (!sub) return "ok"
      // Activate Pro until the end of the period this payment pays for.
      const due = payment.dueDate ?? now.toISOString().slice(0, 10)
      const end = periodEnd(due, sub.planPeriod)
      const current = await store.getProfilePlan(userId)
      const next = endOfDay(end)
      const keep = current.planUntil && new Date(current.planUntil).getTime() > new Date(next).getTime() ? current.planUntil : next
      await store.setProfilePlan(userId, { plan: "pro", planUntil: keep })
      await store.patchSubscription(sub.id, { status: "active", currentPeriodEnd: end, graceUntil: null })
      return "ok"
    }

    case "PAYMENT_OVERDUE":
      await upsert("OVERDUE")
      // A failed RENEWAL starts the grace period; a first payment that was never paid just stays pending.
      if (sub && sub.status === "active") await store.patchSubscription(sub.id, { status: "overdue", graceUntil: new Date(now.getTime() + GRACE_DAYS * DAY).toISOString() })
      return "ok"

    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED": {
      await upsert("REFUNDED")
      if (!sub) return "ok"
      // The money went back: Pro ends now. The person's data is untouched, it comes back with Pro.
      await store.setProfilePlan(userId, { plan: "free", planUntil: null })
      await store.patchSubscription(sub.id, { status: "ended", cancelAtPeriodEnd: true, graceUntil: null })
      return "ok"
    }

    default:
      return "ignored"
  }
}

/**
 * The checkout asks "was it paid?" while the Pix dialog is open. If the webhook has not arrived yet, ask Asaas about THIS person's payment
 * and apply the result with the same handler (the event id makes it idempotent, so the real webhook arriving later changes nothing).
 */
export async function syncPayment(deps: { asaas: Pick<AsaasClient, "getPayment">; store: BillingStore; now: Date }, userId: string, paymentId: string): Promise<boolean> {
  const invoice = await deps.store.invoiceByAsaasPaymentId(paymentId)
  if (!invoice || invoice.userId !== userId) return false
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(invoice.status)) return true
  try {
    const payment = await deps.asaas.getPayment(paymentId)
    if (payment.status !== "RECEIVED" && payment.status !== "CONFIRMED") return false
    await handleWebhook(deps.store, { id: `sync_${paymentId}_${payment.status}`, event: payment.status === "RECEIVED" ? "PAYMENT_RECEIVED" : "PAYMENT_CONFIRMED", payment: { ...payment, subscription: payment.subscription ?? invoice.asaasSubscriptionId } }, deps.now)
    return true
  } catch {
    return false
  }
}
