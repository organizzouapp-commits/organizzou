import { describe, expect, it } from "vitest"

import { annualPerMonthCents, bannerFor, checkoutIssue, dateBR, daysUntil, INITIAL_DRAFT, parseAsaasInstant, pixCountdown, priceLine, savingText, summaryOf } from "./plan-model"

const NOW = new Date("2026-11-20T15:00:00Z")
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()
const base = { plan: "free" as const, subscription: null, pendingPayment: false, chargeFailed: false, planUntil: null }

describe("checkout draft", () => {
  it("asks for a valid CPF/CNPJ first, then a method", () => {
    expect(checkoutIssue(INITIAL_DRAFT)).toBe("Informe um CPF ou CNPJ válido.")
    expect(checkoutIssue({ ...INITIAL_DRAFT, cpfCnpj: "529.982.247-25" })).toBe("Escolha como quer pagar.")
    expect(checkoutIssue({ period: "annual", method: "pix", cpfCnpj: "529.982.247-25" })).toBeNull()
    expect(checkoutIssue({ period: "monthly", method: "card", cpfCnpj: "11.222.333/0001-81" })).toBeNull()
  })
  it("the summary: charged today and the next charge", () => {
    expect(summaryOf({ period: "monthly", method: "card", cpfCnpj: "" }, "2026-11-20")).toEqual({ todayCents: 490, nextCents: 2490, nextOn: "2026-12-20", promo: true, period: "monthly" })
    expect(summaryOf({ period: "monthly", method: "pix", cpfCnpj: "" }, "2026-11-20", false)).toMatchObject({ todayCents: 2490, promo: false })
    expect(summaryOf({ period: "annual", method: "boleto", cpfCnpj: "" }, "2026-11-20")).toMatchObject({ todayCents: 25000, nextCents: 25000, nextOn: "2027-11-20" })
  })
  it("the prices as the design says them", () => {
    expect(priceLine("monthly")).toBe("R$ 4,90 no 1º mês, depois R$ 24,90/mês")
    expect(priceLine("annual")).toBe("R$ 250,00/ano")
    expect(annualPerMonthCents()).toBe(2083)
    expect(savingText()).toBe("Economize R$ 48,80 por ano")
  })
})

describe("dates and the Pix countdown", () => {
  it("formats dates and counts days", () => {
    expect(dateBR("2026-12-20")).toBe("20/12/2026")
    expect(daysUntil(day(3), NOW)).toBe(3)
    expect(daysUntil(day(-2), NOW)).toBe(0)
    expect(daysUntil(null, NOW)).toBeNull()
  })
  it("reads Asaas's Pix expiry as Brasília time", () => {
    expect(parseAsaasInstant("2026-11-21 23:59:59").toISOString()).toBe("2026-11-22T02:59:59.000Z")
  })
  it("counts down in mm:ss, then hours, then days, and says when it expired", () => {
    expect(pixCountdown("2026-11-20 12:30:00", NOW)).toEqual({ expired: false, label: "30:00" })
    expect(pixCountdown("2026-11-20 12:05:09", NOW)).toEqual({ expired: false, label: "05:09" })
    expect(pixCountdown("2026-11-20 13:05:09", NOW)).toEqual({ expired: false, label: "1h 05min" })
  })
  it("longer waits and expiry", () => {
    expect(pixCountdown("2026-11-21 23:59:59", NOW)).toMatchObject({ expired: false, label: "1 dias" })
    expect(pixCountdown("2026-11-20 08:00:00", NOW)).toEqual({ expired: true, label: "Expirou" })
    expect(pixCountdown("lixo", NOW).expired).toBe(true)
  })
})

describe("banners", () => {
  const sub = (over: Record<string, unknown>) => ({ status: "active", period: "monthly" as const, method: "card" as const, cancelAtPeriodEnd: false, currentPeriodEnd: null, graceUntil: null, nextChargeCents: 2490, nextChargeOn: null, ...over })
  it("nothing for a normal Free or Pro", () => {
    expect(bannerFor(base, NOW)).toBeNull()
    expect(bannerFor({ ...base, plan: "pro", subscription: sub({}) }, NOW)).toBeNull()
  })
  it("pagamento pendente while the webhook has not confirmed", () => {
    expect(bannerFor({ ...base, pendingPayment: true, subscription: sub({ status: "pending" }) }, NOW)).toMatchObject({ kind: "pending", title: "Pagamento pendente" })
  })
  it("cobrança falhou, with the days left of the grace period", () => {
    const banner = bannerFor({ ...base, plan: "pro", chargeFailed: true, subscription: sub({ status: "overdue", graceUntil: day(2) }) }, NOW)
    expect(banner).toMatchObject({ kind: "failed", title: "A cobrança não passou" })
    expect(banner?.text).toContain("mais 2 dias")
  })
  it("Pro termina em N dias after a cancel", () => {
    expect(bannerFor({ ...base, plan: "pro", planUntil: day(9), subscription: sub({ cancelAtPeriodEnd: true }) }, NOW)).toMatchObject({ kind: "ending", title: "Pro termina em 9 dias" })
    expect(bannerFor({ ...base, plan: "pro", planUntil: day(1), subscription: sub({ cancelAtPeriodEnd: true }) }, NOW)?.title).toBe("Pro termina em 1 dia")
  })
  it("a failure outranks everything", () => {
    expect(bannerFor({ ...base, plan: "pro", pendingPayment: true, chargeFailed: true, subscription: sub({ status: "overdue", graceUntil: day(1) }) }, NOW)?.kind).toBe("failed")
  })
})
