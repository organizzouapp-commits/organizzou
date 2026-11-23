import type { AsaasClient, AsaasPayment } from "./asaas"
import { AsaasError } from "./asaas"
import { isValidCpfCnpj, onlyDigits } from "./cpf"
import { buildCustomerBody, buildPaymentUpdate, buildSubscriptionBody } from "./payloads"
import { annualSavingCents, fromAsaasValue, type PayMethod, type PlanPeriod, quote, toAsaasValue } from "./pricing"
import { dayOf } from "@/lib/sp-time"
import type { BillingStore } from "./store"

/**
 * The billing operations, with their dependencies passed in (the Asaas client, the store, the clock), so each one is tested without a
 * network or a database. The routes under /api/billing are thin wrappers: session, rate limit, then one of these.
 *
 * FIRST MONTH AT R$ 4,90: Asaas has one `value` per subscription and, in the pages of its documentation read for this work, no way to make
 * only the first charge cheaper. So the subscription is created at the regular value (R$ 24,90, or R$ 250,00 a year), and the FIRST
 * pending charge it generates is edited to R$ 4,90 (PUT /payments/{id}, allowed while a charge is pending). If that edit fails the
 * subscription is deleted again and nothing is charged: the person is never billed the regular price by accident.
 */

export type BillingUser = { id: string; email: string; name: string }
export type Deps = { asaas: AsaasClient; store: BillingStore; now: Date; today: string; siteUrl: string; returnPath: string }

export type Fail = { ok: false; error: string; status: number }
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status })

const METHOD_OF: Record<string, PayMethod> = { CREDIT_CARD: "card", PIX: "pix", BOLETO: "boleto" }
export const methodOf = (billingType: string | undefined): PayMethod | null => (billingType ? (METHOD_OF[billingType] ?? null) : null)

export type CheckoutResult =
  | { ok: true; kind: "pix"; paymentId: string; qrImage: string; payload: string; expiresAt: string; amountCents: number; dueDate: string }
  | { ok: true; kind: "redirect"; paymentId: string; url: string; amountCents: number }
  | Fail

export async function startCheckout(deps: Deps, user: BillingUser, input: { period: PlanPeriod; method: PayMethod; cpfCnpj: string }): Promise<CheckoutResult> {
  const { asaas, store, today } = deps
  if (!isValidCpfCnpj(input.cpfCnpj)) return fail("CPF ou CNPJ inválido. Confira os números e tente de novo.")

  try {
    const previous = await store.latestSubscription(user.id)
    if (previous && previous.status === "active" && !previous.cancelAtPeriodEnd) return fail("Você já tem uma assinatura ativa.", 409)
    // An abandoned checkout is replaced, so retrying never leaves two charges waiting.
    if (previous && previous.status === "pending" && previous.asaasSubscriptionId) {
      await asaas.deleteSubscription(previous.asaasSubscriptionId).catch(() => undefined)
      await store.patchSubscription(previous.id, { status: "canceled" })
    }

    const cpfCnpj = onlyDigits(input.cpfCnpj)
    let customer = await store.getCustomer(user.id)
    if (!customer) {
      const created = await asaas.createCustomer(buildCustomerBody({ name: user.name, cpfCnpj, email: user.email, userId: user.id }))
      await store.saveCustomer(user.id, created.id, cpfCnpj)
      customer = { asaasCustomerId: created.id, cpfCnpj }
    }

    const firstTime = !(await store.hasPaidInvoice(user.id))
    const q = quote(input.period, input.method, today, firstTime)

    // The first charge is due today in Sao Paulo (Asaas counts days in Brasilia time), never before it.
    const dueToday = today > dayOf(deps.now, 0) ? today : dayOf(deps.now, 0)
    const subscription = await asaas.createSubscription(buildSubscriptionBody({ customerId: customer.asaasCustomerId, method: input.method, quote: q, today: dueToday, userId: user.id }))

    // From here on a failure must not leave a live subscription behind (it would charge the regular price at the next due date).
    let storedId: string | null = null
    const undo = async () => {
      await asaas.deleteSubscription(subscription.id).catch(() => undefined)
      if (storedId) await store.patchSubscription(storedId, { status: "canceled" }).catch(() => undefined)
    }
    const abort = async (message: string): Promise<Fail> => {
      await undo()
      return fail(message, 502)
    }
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
      await undo()
      throw error
    }
  } catch (error) {
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
