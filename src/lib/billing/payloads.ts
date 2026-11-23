import { onlyDigits } from "./cpf"
import type { PayMethod, Quote } from "./pricing"
import { assertChargeable, toAsaasValue } from "./pricing"

/**
 * The exact bodies sent to Asaas, built in one place and tested. Rules: only fields Asaas documents for the call, numbers as numbers,
 * dates as YYYY-MM-DD, plain ASCII text for descriptions, and no empty, null or undefined value (Asaas answers `invalid_object` to a body it
 * cannot read as the object it expects). No field here is optional "just in case".
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Drops keys whose value is undefined, null or an empty string. */
export function compact<T extends Record<string, unknown>>(body: T): Partial<T> {
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>
}

/** Plain ASCII text with single spaces: no accents, no symbols such as a middle dot, at most `max` characters. */
export function plainText(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

export type CustomerBody = { name: string; cpfCnpj: string; email: string; externalReference: string }

/** The customer: a name (never empty), the document as digits only, the e-mail trimmed and lower case. */
export function buildCustomerBody(input: { name: string; cpfCnpj: string; email: string; userId: string }): CustomerBody {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 100) || email.split("@")[0] || "Cliente Organizzou"
  return { name, cpfCnpj: onlyDigits(input.cpfCnpj), email, externalReference: input.userId }
}

export type SubscriptionBody = { customer: string; billingType: "PIX" | "BOLETO" | "CREDIT_CARD"; value: number; nextDueDate: string; cycle: "MONTHLY" | "YEARLY"; description: string; externalReference: string }

const BILLING_TYPE: Record<PayMethod, SubscriptionBody["billingType"]> = { card: "CREDIT_CARD", pix: "PIX", boleto: "BOLETO" }
export const billingTypeOf = (method: PayMethod) => BILLING_TYPE[method]

/**
 * The subscription at its regular value. `today` is the day in America/Sao_Paulo (Asaas counts days in Brasilia time): the first charge is
 * due today, never in the past. No callback, discount, fine, interest or card fields: Pix and boleto need none, and the card is entered on the
 * Asaas page, not here.
 */
export function buildSubscriptionBody(input: { customerId: string; method: PayMethod; quote: Quote; today: string; userId: string }): SubscriptionBody {
  if (!DAY.test(input.today)) throw new Error("invalid due date")
  if (!input.customerId) throw new Error("missing customer")
  return {
    customer: input.customerId,
    billingType: BILLING_TYPE[input.method],
    value: toAsaasValue(assertChargeable(input.quote.regularCents)),
    nextDueDate: input.today,
    cycle: input.quote.cycle,
    description: plainText(input.quote.description, 100),
    externalReference: input.userId,
  }
}

/** The edit of the first charge: Asaas asks for billingType, value and dueDate together. */
export function buildPaymentUpdate(input: { method: PayMethod; cents: number; dueDate: string; description: string }) {
  return { billingType: BILLING_TYPE[input.method], value: toAsaasValue(assertChargeable(input.cents)), dueDate: input.dueDate, description: plainText(input.description, 100) }
}
