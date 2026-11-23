import { addMonths, addYears, format, parseISO } from "date-fns"

import { PLANS } from "@/lib/plans"

/**
 * What a checkout charges and when. Pure, so the screen and the server show and charge the same numbers (prices come from src/lib/plans.ts).
 * Monthly: the first month is the launch price (only for someone who never had a paid plan), then the regular price every month.
 * Annual: one flat price a year.
 */

export type PlanPeriod = "monthly" | "annual"
export type PayMethod = "card" | "pix" | "boleto"

export type Quote = {
  period: PlanPeriod
  method: PayMethod
  /** "Cobrado hoje". */
  firstChargeCents: number
  /** The value of every charge after the first. */
  regularCents: number
  /** True when the first charge is cheaper than the regular one. */
  promo: boolean
  cycle: "MONTHLY" | "YEARLY"
  /** "Próxima cobrança": the day it happens, counted from today. */
  nextChargeOn: string
  description: string
}

/** `firstTime`: the person never paid for a plan before (the launch price is for the first month ever, not for every come-back). */
export function quote(period: PlanPeriod, method: PayMethod, today: string, firstTime = true): Quote {
  const { monthlyCents, yearlyCents, firstMonthCents } = PLANS.pro.price
  if (period === "annual") {
    return { period, method, firstChargeCents: yearlyCents, regularCents: yearlyCents, promo: false, cycle: "YEARLY", nextChargeOn: format(addYears(parseISO(today), 1), "yyyy-MM-dd"), description: "Organizzou Pro - plano anual" }
  }
  const promo = firstTime && firstMonthCents < monthlyCents
  return {
    period,
    method,
    firstChargeCents: promo ? firstMonthCents : monthlyCents,
    regularCents: monthlyCents,
    promo,
    cycle: "MONTHLY",
    nextChargeOn: format(addMonths(parseISO(today), 1), "yyyy-MM-dd"),
    description: "Organizzou Pro - plano mensal",
  }
}

/** The end of the period a payment due on `dueDate` pays for. */
export function periodEnd(dueDate: string, period: PlanPeriod): string {
  const start = parseISO(dueDate)
  return format(period === "annual" ? addYears(start, 1) : addMonths(start, 1), "yyyy-MM-dd")
}

/** Asaas refuses any charge below R$ 5,00 ("o valor da cobrança não pode ser menor que R$ 5,00"). */
export const MIN_CHARGE_CENTS = 500

export const BELOW_MINIMUM_MESSAGE = "Esse valor de cobrança não é aceito pelo serviço de pagamento. Nada foi cobrado. Avise o suporte do Organizzou."

/** Thrown when a charge we are about to create or edit is below what Asaas accepts. It is raised BEFORE Asaas is called. */
export class BelowMinimumChargeError extends Error {
  constructor(readonly cents: number) {
    super(`charge of ${cents} cents is below the minimum of ${MIN_CHARGE_CENTS}`)
    this.name = "BelowMinimumChargeError"
  }
}

/** Throws unless the value is a whole number of cents of at least MIN_CHARGE_CENTS. */
export function assertChargeable(cents: number): number {
  if (!Number.isInteger(cents) || cents < MIN_CHARGE_CENTS) throw new BelowMinimumChargeError(cents)
  return cents
}

/** Every value a checkout will put in front of Asaas: the first charge, the regular value of the subscription. Throws if any is too low. */
export function assertQuoteChargeable(q: Pick<Quote, "firstChargeCents" | "regularCents">) {
  assertChargeable(q.firstChargeCents)
  assertChargeable(q.regularCents)
}

/** Cents to the decimal number Asaas expects (24.9). */
export const toAsaasValue = (cents: number) => Math.round(cents) / 100
/** The decimal number Asaas sends (24.9) to integer cents. */
export const fromAsaasValue = (value: number) => Math.round(value * 100)

/** "Economize R$ 48,80 por ano": 12 monthly payments minus the annual price. */
export const annualSavingCents = () => PLANS.pro.price.monthlyCents * 12 - PLANS.pro.price.yearlyCents
