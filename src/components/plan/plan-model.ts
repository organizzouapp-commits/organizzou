import { isValidCpfCnpj } from "@/lib/billing/cpf"
import { annualSavingCents, type PayMethod, type PlanPeriod, quote } from "@/lib/billing/pricing"
import type { BillingStatus } from "@/lib/billing/service"
import { formatBRL } from "@/lib/money"
import { PLANS } from "@/lib/plans"

/** The plan screen as pure functions: what the checkout asks and shows, which banner to show, how long a Pix has left. Tested without a browser. */

export type CheckoutDraft = { period: PlanPeriod; method: PayMethod | null; cpfCnpj: string }
export const INITIAL_DRAFT: CheckoutDraft = { period: "monthly", method: null, cpfCnpj: "" }

/** The message that blocks the next step, or null. */
export function checkoutIssue(draft: CheckoutDraft): string | null {
  if (!isValidCpfCnpj(draft.cpfCnpj)) return "Informe um CPF ou CNPJ válido."
  if (!draft.method) return "Escolha como quer pagar."
  return null
}

/** "Cobrado hoje" and "Próxima cobrança". */
export function summaryOf(draft: CheckoutDraft, today: string, firstTime = true) {
  const q = quote(draft.period, draft.method ?? "card", today, firstTime)
  return { todayCents: q.firstChargeCents, nextCents: q.regularCents, nextOn: q.nextChargeOn, promo: q.promo, period: draft.period }
}

/** "R$ 4,90 no 1º mês, depois R$ 24,90/mês" and the annual line. */
export function priceLine(period: PlanPeriod): string {
  const { monthlyCents, yearlyCents, firstMonthCents } = PLANS.pro.price
  return period === "annual" ? `${formatBRL(yearlyCents)}/ano` : `${formatBRL(firstMonthCents)} no 1º mês, depois ${formatBRL(monthlyCents)}/mês`
}
/** The annual price per month: R$ 250,00 / 12 = R$ 20,83. */
export const annualPerMonthCents = () => Math.round(PLANS.pro.price.yearlyCents / 12)
export const savingText = () => `Economize ${formatBRL(annualSavingCents())} por ano`

export const dateBR = (day: string | null | undefined) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "")

/** Whole days from `now` to an instant (0 when it is today or already past). */
export function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now.getTime()
  return Number.isNaN(ms) ? null : Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Asaas sends the Pix expiry as "2026-11-21 23:59:59" (Brasília time). */
export function parseAsaasInstant(value: string): Date {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}-03:00`)
}

/** The time a Pix has left: "mm:ss" under an hour, "Xh Ymin" under a day, "X dias" beyond. */
export function pixCountdown(expiresAt: string, now: Date): { expired: boolean; label: string } {
  const left = parseAsaasInstant(expiresAt).getTime() - now.getTime()
  if (Number.isNaN(left) || left <= 0) return { expired: true, label: "Expirou" }
  const s = Math.floor(left / 1000)
  if (s < 3600) return { expired: false, label: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` }
  if (s < 86_400) return { expired: false, label: `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}min` }
  return { expired: false, label: `${Math.floor(s / 86_400)} dias` }
}

export type Banner = { kind: "pending" | "failed" | "ending"; title: string; text: string }

/** The one banner to show above the plan screen (the most urgent first). */
export function bannerFor(status: Pick<BillingStatus, "plan" | "subscription" | "pendingPayment" | "chargeFailed" | "planUntil">, now: Date): Banner | null {
  if (status.chargeFailed && status.subscription && status.subscription.status === "overdue") {
    const days = daysUntil(status.subscription.graceUntil, now)
    return { kind: "failed", title: "A cobrança não passou", text: days ? `Seu Pro continua por mais ${days} ${days === 1 ? "dia" : "dias"}. Pague a fatura em aberto para não perder o acesso.` : "Pague a fatura em aberto para manter o Pro." }
  }
  if (status.pendingPayment) return { kind: "pending", title: "Pagamento pendente", text: "Estamos esperando a confirmação. Assim que o pagamento cair, o Pro é liberado sozinho." }
  if (status.plan === "pro" && status.subscription?.cancelAtPeriodEnd) {
    const days = daysUntil(status.planUntil, now)
    return { kind: "ending", title: days === null ? "Sua assinatura foi cancelada" : `Pro termina em ${days} ${days === 1 ? "dia" : "dias"}`, text: "Seus dados continuam guardados e voltam quando você assinar de novo." }
  }
  return null
}

export const CANCEL_REASONS = ["Está caro", "Uso pouco", "Faltou um recurso", "Vou voltar depois", "Outro motivo"] as const

export const METHOD_LABEL: Record<PayMethod, string> = { card: "Cartão de crédito", pix: "Pix", boleto: "Boleto" }
export const METHOD_HINT: Record<PayMethod, string> = {
  card: "Renova sozinho todo período, na página segura do Asaas.",
  pix: "O QR code aparece aqui. Uma nova cobrança chega por e-mail a cada período.",
  boleto: "Abrimos o boleto na página do Asaas. Uma nova cobrança chega por e-mail a cada período.",
}
