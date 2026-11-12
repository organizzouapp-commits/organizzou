import { describe, expect, it } from "vitest"

import { clampDay, installmentCents, installmentIndex, installmentPreview, installmentView, lastMonth, newInstallmentMeta, parseBillMeta, remainingFrom, removeInstallments, setInstallmentAmount, setInstallmentPaid } from "./installments"
import type { RecurringBillRow } from "./types"

const bill: RecurringBillRow = { id: "b", user_id: "u", name: "Notebook", amount_cents: 15000, due_day: 28, category_id: null, active: true, last_paid_month: null, created_at: "", updated_at: "" }
const meta = newInstallmentMeta(10, "2027-03-31")

describe("series", () => {
  it("runs for exactly N months", () => {
    expect(lastMonth(meta)).toBe("2027-12")
    expect(installmentIndex(meta, "2027-02")).toBeNull()
    expect(installmentIndex(meta, "2027-03")).toBe(1)
    expect(installmentIndex(meta, "2027-12")).toBe(10)
    expect(installmentIndex(meta, "2028-01")).toBeNull()
  })
  it("clamps days 29-31 to the last day of short months", () => {
    expect(clampDay("2027-02", 31)).toBe(28)
    expect(clampDay("2028-02", 30)).toBe(29)
    expect(clampDay("2027-04", 31)).toBe(30)
    expect(clampDay("2027-05", 31)).toBe(31)
    const view = installmentView(bill, meta, "2027-04", "2027-04-01")
    expect(view?.dueOn).toBe("2027-04-30")
    expect(view?.installment).toEqual({ index: 2, total: 10 })
  })
})

describe("paying", () => {
  it("only touches that installment", () => {
    const paid = setInstallmentPaid(meta, "2027-05", true)
    expect(installmentView(bill, paid, "2027-05", "2027-05-01")?.status).toBe("paid")
    expect(installmentView(bill, paid, "2027-04", "2027-05-01")?.status).toBe("overdue")
    expect(setInstallmentPaid(paid, "2027-05", false).paidMonths).toEqual([])
  })
  it("shows what remains", () => {
    const paid = setInstallmentPaid(setInstallmentPaid(meta, "2027-03", true), "2027-04", true)
    expect(remainingFrom(bill, paid, "2027-03")).toEqual({ count: 8, cents: 8 * 15000 })
  })
})

describe("amount", () => {
  it("converts a total into installments", () => {
    expect(installmentCents("total", 150000, 10)).toBe(15000)
    expect(installmentCents("total", 100000, 3)).toBe(33333)
    expect(installmentCents("installment", 15000, 10)).toBe(15000)
  })
  it("previews the series", () => {
    expect(installmentPreview(10, 15000, "2027-03")).toBe("10x de R$ 150,00 · de mar/2027 a dez/2027")
  })
})

describe("editing and deleting by scope", () => {
  it("deletes one, the following, or all", () => {
    expect(removeInstallments(meta, "2027-05", "this")?.skipped).toEqual(["2027-05"])
    expect(installmentIndex(removeInstallments(meta, "2027-05", "this")!, "2027-05")).toBeNull()
    const following = removeInstallments(setInstallmentPaid(meta, "2027-03", true), "2027-06", "following")
    expect(following?.total).toBe(3)
    expect(following?.paidMonths).toEqual(["2027-03"])
    expect(removeInstallments(meta, "2027-03", "following")).toBeNull()
    expect(removeInstallments(meta, "2027-05", "all")).toBeNull()
  })
  it("changes the amount for one, the following, or all", () => {
    expect(setInstallmentAmount(meta, "2027-05", "this", 9000).meta.amounts).toEqual({ "2027-05": 9000 })
    const following = setInstallmentAmount(meta, "2027-10", "following", 9000).meta.amounts
    expect(Object.keys(following)).toEqual(["2027-10", "2027-11", "2027-12"])
    expect(setInstallmentAmount(meta, "2027-05", "all", 9000)).toEqual({ meta: { ...meta, amounts: {} }, billCents: 9000 })
    expect(installmentView(bill, setInstallmentAmount(meta, "2027-05", "this", 9000).meta, "2027-05", "2027-05-01")?.bill.amount_cents).toBe(9000)
  })
})

describe("parseBillMeta", () => {
  it("keeps valid series and drops broken ones", () => {
    const parsed = parseBillMeta({ ok: meta, bad: { total: 999, firstMonth: "x", firstDay: 1 }, junk: 5 })
    expect(Object.keys(parsed)).toEqual(["ok"])
  })
})
