import type { AsaasClient, AsaasPayment } from "./asaas"
import { AsaasError } from "./asaas"
import { isValidCpfCnpj, onlyDigits } from "./cpf"
import { buildCustomerBody, buildPaymentUpdate, buildSubscriptionBody } from "./payloads"
import { annualSavingCents, assertQuoteChargeable, BELOW_MINIMUM_MESSAGE, BelowMinimumChargeError, fromAsaasValue, type PayMethod, type PlanPeriod, quote, toAsaasValue } from "./pricing"
import { dayOf } from "@/lib/sp-time"
import type { BillingStore } from "./store"

/**
 * The billing operations, with their dependencies passed in (the Asaas client, the store, the clock), so each one is tested without a
 * network or a database. The routes under /api/billing are thin wrappers: session, rate limit, then one of these.
 *
 * FIRST MONTH AT THE LAUNCH PRICE (LAUNCH_PRICE_CENTS): Asaas has one `value` per subscription and, in the pages of its documentation read for this work, no way to make
 * only the first charge cheaper. So the subscription is created at the regular value (R$ 24,90, or R$ 250,00 a year), and the FIRST
 * pending charge it generates is edited to the launch price (PUT /payments/{id}, allowed while a charge is pending). If that edit fails the
 * subscription is deleted again and nothing is charged: the person is never billed the regular price by accident.
 */

export type BillingUser = { id: string; email: string; name: string }
export type Deps = { asaas: AsaasClient; store: BillingStore; now: Date; today: string; siteUrl: string; returnPath: string; /** Waits between delete attempts (injected so tests do not wait). */ sleep?: (ms: number) => Promise<void> }

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
/** Short exponential backoff between the three attempts to delete a subscription. */
export const RETRY_DELAYS_MS = [300, 1200] as const

/** What the person reads when a subscription could not be removed: something may still be charged, so they must not try again alone. */
export const ORPHAN_MESSAGE = "Não consegui concluir o pagamento e uma assinatura ficou pendente de limpeza. Não tente de novo: avise o suporte do Organizzou para ela ser encerrada."

/**
 * Deletes an Asaas subscription with up to three attempts and a short backoff. "Not found" counts as success (it is already gone).
 * Returns the last HTTP status when every attempt failed (0 = network or timeout).
 */
export async function deleteSubscriptionReliably(asaas: Pick<AsaasClient, "deleteSubscription">, id: string, sleep: (ms: number) => Promise<void> = defaultSleep): Promise<{ ok: true } | { ok: false; status: number }> {
  let status = 0
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await asaas.deleteSubscription(id)
      return { ok: true }
    } catch (error) {
      if (error instanceof AsaasError && error.status === 404) return { ok: true }
      status = error instanceof AsaasError ? error.status : 0
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  return { ok: false, status }
}

/**
 * Removes a subscription after a failed checkout. If it cannot be removed it is NOT swallowed: an error event (operation, status and the Asaas
 * subscription id only) is logged and the subscription is recorded as an open orphan, so it can be cleaned from the admin.
 */
export async function cleanUpSubscription(deps: Pick<Deps, "asaas" | "store" | "sleep">, userId: string, subscriptionId: string): Promise<boolean> {
  const result = await deleteSubscriptionReliably(deps.asaas, subscriptionId, deps.sleep)
  if (result.ok) return true
  console.error(JSON.stringify({ event: "asaas_orphan", op: "deleteSubscription", status: result.status, subscription: subscriptionId }))
  await deps.store.recordOrphan(subscriptionId, userId).catch(() => undefined)
  return false
}

export type Fail = { ok: false; error: string; status: number }
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status })

const METHOD_OF: Record<string, PayMethod> = { CREDIT_CARD: "card", PIX: "pix", BOLETO: "boleto" }
export const methodOf = (billingType: string | undefined): PayMethod | null => (billingType ? (METHOD_OF[billingType] ?? null) : null)

/**
 * Is this subscription really still billing at Asaas? "gone": deleted, inactive, expired, not found (or we never had its id). "unreachable":
 * Asaas could not be asked, so nothing can be concluded. Our row alone is not trusted: it can be stale (a cancel in the Asaas panel, an admin).
 */
export async function subscriptionAtAsaas(asaas: Pick<AsaasClient, "getSubscription">, id: string | null): Promise<"live" | "gone" | "unreachable"> {
  if (!id) return "gone"
  try {
    const remote = await asaas.getSubscription(id)
    return remote.deleted === true || remote.status !== "ACTIVE" ? "gone" : "live"
  } catch (error) {
    if (error instanceof AsaasError && error.status === 404) return "gone"
    return "unreachable"
  }
}

/**
 * The launch price is for someone who NEVER paid. It is decided by PAID INVOICES only (billing_invoices), never by subscription rows: an account
 * whose subscription was canceled and ended, or abandoned unpaid checkouts, still gets it; one that paid once (even if refunded later) does not,
 * however many times it subscribes again.
 */
export const isLaunchEligible = async (store: Pick<BillingStore, "hasPaidInvoice">, userId: string): Promise<boolean> => !(await store.hasPaidInvoice(userId))

export const UNREACHABLE_MESSAGE = "Não consegui confirmar sua assinatura agora. Tente de novo em instantes."

export type CheckoutResult =
  | { ok: true; kind: "pix"; paymentId: string; qrImage: string; payload: string; expiresAt: string; amountCents: number; dueDate: string }
  | { ok: true; kind: "redirect"; paymentId: string; url: string; amountCents: number }
  | Fail

export async function startCheckout(deps: Deps, user: BillingUser, input: { period: PlanPeriod; method: PayMethod; cpfCnpj: string }): Promise<CheckoutResult> {
  const { asaas, store, today } = deps
  if (!isValidCpfCnpj(input.cpfCnpj)) return fail("CPF ou CNPJ inválido. Confira os números e tente de novo.")

  try {
    const previous = await store.latestSubscription(user.id)
    if (previous && (previous.status === "active" || previous.status === "overdue") && !previous.cancelAtPeriodEnd) {
      // Ask Asaas before refusing: a subscription canceled there (the panel, an admin) must not lock the person out for good.
      const state = await subscriptionAtAsaas(asaas, previous.asaasSubscriptionId)
      if (state === "live") return fail("Você já tem uma assinatura ativa.", 409)
      if (state === "unreachable") return fail(UNREACHABLE_MESSAGE, 503)
      // Self-heal: it is over at Asaas, so our row is too, and the new checkout goes on.
      await store.patchSubscription(previous.id, { status: "ended", cancelAtPeriodEnd: true, graceUntil: null })
    }
    // Retries are idempotent: a subscription an earlier failed attempt left behind (an open orphan) is cleaned first, and so is an abandoned
    // pending checkout. If one cannot be removed, no second subscription is created on top of it.
    for (const orphan of await store.openOrphans(user.id)) {
      if (!(await deleteSubscriptionReliably(asaas, orphan.asaasSubscriptionId, deps.sleep)).ok) return fail(ORPHAN_MESSAGE, 409)
      await store.resolveOrphan(orphan.asaasSubscriptionId)
    }
    if (previous && previous.status === "pending" && previous.asaasSubscriptionId) {
      if (!(await cleanUpSubscription(deps, user.id, previous.asaasSubscriptionId))) return fail(ORPHAN_MESSAGE, 409)
      await store.patchSubscription(previous.id, { status: "canceled" })
    }

    const firstTime = await isLaunchEligible(store, user.id)
    const q = quote(input.period, input.method, today, firstTime)
    // Fail fast: a value Asaas would refuse never leaves this server.
    assertQuoteChargeable(q)

    const cpfCnpj = onlyDigits(input.cpfCnpj)
    let customer = await store.getCustomer(user.id)
    if (!customer) {
      const created = await asaas.createCustomer(buildCustomerBody({ name: user.name, cpfCnpj, email: user.email, userId: user.id }))
      await store.saveCustomer(user.id, created.id, cpfCnpj)
      customer = { asaasCustomerId: created.id, cpfCnpj }
    }

    // The first charge is due today in Sao Paulo (Asaas counts days in Brasilia time), never before it.
    const dueToday = today > dayOf(deps.now, 0) ? today : dayOf(deps.now, 0)
    const subscription = await asaas.createSubscription(buildSubscriptionBody({ customerId: customer.asaasCustomerId, method: input.method, quote: q, today: dueToday, userId: user.id }))

    // From here on a failure must not leave a live subscription behind (it would charge the regular price at the next due date).
    let storedId: string | null = null
    const undo = async (): Promise<boolean> => {
      const cleaned = await cleanUpSubscription(deps, user.id, subscription.id)
      if (cleaned && storedId) await store.patchSubscription(storedId, { status: "canceled" }).catch(() => undefined)
      return cleaned
    }
    // The friendly "nothing was charged" message only when the subscription is really gone; otherwise the person is told to call support.
    const abort = async (message: string): Promise<Fail> => ((await undo()) ? fail(message, 502) : fail(ORPHAN_MESSAGE, 502))
    try {

    const first = earliest((await asaas.listSubscriptionPayments(subscription.id)).data ?? [])
    if (!first) return abort("Não consegui criar a primeira cobrança. Nada foi cobrado. Tente de novo.")

    let payment: AsaasPayment = first
    if (q.promo) {
      try {
        payment = { ...first, ...(await asaas.updatePayment(first.id, buildPaymentUpdate({ method: input.method, cents: q.firstChargeCents, dueDate: first.dueDate, description: `${q.description} (1o mes)` }))) }
      } catch {
        return abort("Não consegui aplicar o preço de lançamento. Nada foi cobrado. Tente de novo.")
      }
    }

    const row = await store.insertSubscription({ userId: user.id, asaasSubscriptionId: subscription.id, planPeriod: input.period, method: input.method, status: "pending" })
    storedId = row.id
    await store.upsertInvoice({
      userId: user.id,
      asaasSubscriptionId: subscription.id,
      asaasPaymentId: payment.id,
      amountCents: q.firstChargeCents,
      status: payment.status || "PENDING",
      method: input.method,
      dueDate: payment.dueDate,
      paidAt: null,
      invoiceUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
      description: q.description,
    })

    if (input.method === "pix") {
      const pix = await asaas.getPixQrCode(payment.id)
      return { ok: true, kind: "pix", paymentId: payment.id, qrImage: pix.encodedImage, payload: pix.payload, expiresAt: pix.expirationDate, amountCents: q.firstChargeCents, dueDate: payment.dueDate }
    }
    // Card and boleto: the Asaas-hosted page. Card data never touches this server.
    const url = input.method === "boleto" ? (payment.bankSlipUrl ?? payment.invoiceUrl) : payment.invoiceUrl
    if (!url) return abort("Não consegui abrir a página de pagamento. Nada foi cobrado. Tente de novo.")
    return { ok: true, kind: "redirect", paymentId: payment.id, url, amountCents: q.firstChargeCents }
    } catch (error) {
      if (!(await undo())) return fail(ORPHAN_MESSAGE, 502)
      throw error
    }
  } catch (error) {
    if (error instanceof BelowMinimumChargeError) {
      console.error(JSON.stringify({ event: "billing_below_minimum", op: "checkout", cents: error.cents }))
      return fail(BELOW_MINIMUM_MESSAGE, 500)
    }
    return error instanceof AsaasError ? fail(error.userMessage, error.status === 0 || error.status >= 500 ? 502 : 400) : fail("Não consegui iniciar o pagamento agora. Tente de novo em instantes.", 500)
  }
}

const earliest = (payments: AsaasPayment[]) => [...payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null

// ---- status -------------------------------------------------------------------------------------------------------------------

export type BillingStatus = {
  plan: "free" | "pro"
  planUntil: string | null
  subscription: null | {
    status: string
    period: PlanPeriod
    method: PayMethod
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
    graceUntil: string | null
    nextChargeCents: number
    nextChargeOn: string | null
  }
  /** A payment was started and is not confirmed yet. */
  pendingPayment: boolean
  /** The latest charge failed or is overdue. */
  chargeFailed: boolean
  lastInvoice: { status: string; amountCents: number; dueDate: string | null } | null
  annualSavingCents: number
}

export async function getStatus(deps: Pick<Deps, "store" | "now">, userId: string): Promise<BillingStatus> {
  const { store } = deps
  const [profile, sub, invoices] = await Promise.all([store.getProfilePlan(userId), store.latestSubscription(userId), store.listInvoices(userId, 3)])
  const until = profile.planUntil
  const pro = profile.plan === "pro" && (!until || new Date(until).getTime() > deps.now.getTime())
  const last = invoices[0] ?? null
  const regular = sub ? quote(sub.planPeriod, sub.method, "2000-01-01", false).regularCents : 0
  return {
    plan: pro ? "pro" : "free",
    planUntil: until,
    subscription: sub
      ? { status: sub.status, period: sub.planPeriod, method: sub.method, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, currentPeriodEnd: sub.currentPeriodEnd, graceUntil: sub.graceUntil, nextChargeCents: regular, nextChargeOn: sub.cancelAtPeriodEnd || sub.status === "canceled" || sub.status === "ended" ? null : (sub.currentPeriodEnd ?? until) }
      : null,
    pendingPayment: Boolean(sub && sub.status === "pending"),
    chargeFailed: Boolean(sub && (sub.status === "overdue" || last?.status === "OVERDUE")),
    lastInvoice: last ? { status: last.status, amountCents: last.amountCents, dueDate: last.dueDate } : null,
    annualSavingCents: annualSavingCents(),
  }
}

// ---- cancel and change --------------------------------------------------------------------------------------------------------

export type CancelResult = { ok: true; endsOn: string | null } | Fail

/** Cancels at the end of the paid period: Pro stays until plan_until, nothing more is charged, nothing is deleted. */
export async function cancelSubscription(deps: Pick<Deps, "asaas" | "store">, userId: string): Promise<CancelResult> {
  const sub = await deps.store.latestSubscription(userId)
  if (!sub || sub.status === "canceled" || sub.status === "ended") return fail("Você não tem uma assinatura para cancelar.", 404)
  try {
    if (sub.asaasSubscriptionId) await deps.asaas.deleteSubscription(sub.asaasSubscriptionId).catch((error) => {
      // Already gone on Asaas's side: the goal is reached.
      if (!(error instanceof AsaasError && error.status === 404)) throw error
    })
    const profile = await deps.store.getProfilePlan(userId)
    if (sub.status === "pending") await deps.store.patchSubscription(sub.id, { status: "canceled", cancelAtPeriodEnd: true })
    else await deps.store.patchSubscription(sub.id, { cancelAtPeriodEnd: true })
    return { ok: true, endsOn: profile.planUntil }
  } catch (error) {
    return error instanceof AsaasError ? fail(error.userMessage, 502) : fail("Não consegui cancelar agora. Tente de novo em instantes.", 500)
  }
}

export type ChangeResult = { ok: true; period: PlanPeriod; effectiveOn: string | null } | Fail

/** Monthly <-> annual, from the next charge on (the period already paid is not touched). */
export async function changePlan(deps: Pick<Deps, "asaas" | "store" | "today">, userId: string, period: PlanPeriod): Promise<ChangeResult> {
  const sub = await deps.store.latestSubscription(userId)
  if (!sub || sub.status !== "active" || !sub.asaasSubscriptionId) return fail("Você precisa de uma assinatura ativa para trocar de plano.", 409)
  if (sub.cancelAtPeriodEnd) return fail("Sua assinatura está cancelada. Assine de novo para escolher outro plano.", 409)
  if (sub.planPeriod === period) return fail("Esse já é o seu plano.", 409)
  const q = quote(period, sub.method, deps.today, false)
  try {
    assertQuoteChargeable(q)
  } catch {
    return fail(BELOW_MINIMUM_MESSAGE, 500)
  }
  const profile = await deps.store.getProfilePlan(userId)
  const startsOn = (sub.currentPeriodEnd ?? profile.planUntil)?.slice(0, 10) ?? q.nextChargeOn
  try {
    await deps.asaas.updateSubscription(sub.asaasSubscriptionId, { value: toAsaasValue(q.regularCents), cycle: q.cycle, nextDueDate: startsOn, description: q.description, updatePendingPayments: false })
    await deps.store.patchSubscription(sub.id, { planPeriod: period })
    return { ok: true, period, effectiveOn: startsOn }
  } catch (error) {
    return error instanceof AsaasError ? fail(error.userMessage, 502) : fail("Não consegui trocar de plano agora. Tente de novo em instantes.", 500)
  }
}

export async function listInvoices(deps: Pick<Deps, "store">, userId: string) {
  return deps.store.listInvoices(userId, 24)
}

export { fromAsaasValue }
