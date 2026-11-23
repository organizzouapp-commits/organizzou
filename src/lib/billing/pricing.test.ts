import { describe, expect, it } from "vitest"

import { isValidCnpj, isValidCpf, isValidCpfCnpj, maskCpfCnpj, onlyDigits } from "./cpf"
import { annualSavingCents, fromAsaasValue, periodEnd, quote, toAsaasValue } from "./pricing"

describe("quote", () => {
  it("monthly: R$ 5,00 today, then R$ 24,90 a month, next charge in a month", () => {
    const q = quote("monthly", "card", "2026-11-20")
    expect(q).toMatchObject({ firstChargeCents: 500, regularCents: 2490, promo: true, cycle: "MONTHLY", nextChargeOn: "2026-12-20" })
  })
  it("the launch price is for the first month ever, not for a come-back", () => {
    expect(quote("monthly", "pix", "2026-11-20", false)).toMatchObject({ firstChargeCents: 2490, promo: false })
  })
  it("annual: R$ 250,00 flat, next charge in a year", () => {
    const q = quote("annual", "boleto", "2026-11-20")
    expect(q).toMatchObject({ firstChargeCents: 25000, regularCents: 25000, promo: false, cycle: "YEARLY", nextChargeOn: "2027-11-20" })
    expect(annualSavingCents()).toBe(4880)
  })
  it("month-end dates do not overflow", () => {
    expect(quote("monthly", "card", "2026-01-31").nextChargeOn).toBe("2026-02-28")
    expect(periodEnd("2026-01-31", "monthly")).toBe("2026-02-28")
    expect(periodEnd("2026-11-20", "annual")).toBe("2027-11-20")
  })
  it("converts between cents and the decimals Asaas uses", () => {
    expect(toAsaasValue(2490)).toBe(24.9)
    expect(toAsaasValue(500)).toBe(5)
    expect(fromAsaasValue(24.9)).toBe(2490)
    expect(fromAsaasValue(250)).toBe(25000)
  })
})

describe("CPF and CNPJ", () => {
  it("validates by the check digits", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true)
    expect(isValidCpf("52998224725")).toBe(true)
    expect(isValidCpf("529.982.247-24")).toBe(false)
    expect(isValidCpf("111.111.111-11")).toBe(false)
    expect(isValidCpf("123")).toBe(false)
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true)
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false)
    expect(isValidCpfCnpj("11222333000181")).toBe(true)
    expect(isValidCpfCnpj("")).toBe(false)
  })
  it("masks while typing", () => {
    expect(maskCpfCnpj("52998224725")).toBe("529.982.247-25")
    expect(maskCpfCnpj("5299")).toBe("529.9")
    expect(maskCpfCnpj("529982")).toBe("529.982")
    expect(maskCpfCnpj("11222333000181")).toBe("11.222.333/0001-81")
    expect(maskCpfCnpj("abc")).toBe("")
    expect(onlyDigits("529.982.247-25")).toBe("52998224725")
  })
})

describe("the minimum charge guard (Asaas refuses anything below R$ 5,00)", () => {
  it("the launch price, the regular price and the annual price all satisfy it", async () => {
    const { LAUNCH_PRICE_CENTS, PLANS } = await import("@/lib/plans")
    const { MIN_CHARGE_CENTS } = await import("./pricing")
    expect(MIN_CHARGE_CENTS).toBe(500)
    expect(LAUNCH_PRICE_CENTS).toBeGreaterThanOrEqual(MIN_CHARGE_CENTS)
    expect(PLANS.pro.price.firstMonthCents).toBe(LAUNCH_PRICE_CENTS)
    expect(PLANS.pro.price.monthlyCents).toBeGreaterThanOrEqual(MIN_CHARGE_CENTS)
    expect(PLANS.pro.price.yearlyCents).toBeGreaterThanOrEqual(MIN_CHARGE_CENTS)
  })
  it("every quote we can build passes, and a value below the minimum is refused with a clear error", async () => {
    const { assertChargeable, assertQuoteChargeable, BelowMinimumChargeError } = await import("./pricing")
    for (const period of ["monthly", "annual"] as const) for (const firstTime of [true, false]) expect(() => assertQuoteChargeable(quote(period, "pix", "2026-11-20", firstTime))).not.toThrow()
    expect(assertChargeable(500)).toBe(500)
    expect(() => assertChargeable(490)).toThrow(BelowMinimumChargeError)
    expect(() => assertChargeable(0)).toThrow(BelowMinimumChargeError)
    expect(() => assertChargeable(500.5)).toThrow(BelowMinimumChargeError)
    expect(() => assertChargeable(Number.NaN)).toThrow(BelowMinimumChargeError)
    expect(() => assertQuoteChargeable({ firstChargeCents: 490, regularCents: 2490 })).toThrow(/below the minimum/)
  })
})
