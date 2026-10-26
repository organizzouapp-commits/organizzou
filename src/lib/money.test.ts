import { describe, expect, it } from "vitest"

import { formatBRL, formatCompactBRL, formatSignedBRL, parseBRL } from "./money"

describe("formatBRL", () => {
  it("formats cents in pt-BR", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56")
    expect(formatBRL(0)).toBe("R$ 0,00")
    expect(formatBRL(4500)).toBe("R$ 45,00")
  })

  it("signs amounts with a real minus", () => {
    expect(formatSignedBRL(4500, "out")).toBe("− R$ 45,00")
    expect(formatSignedBRL(780000, "in")).toBe("+ R$ 7.800,00")
  })
})

describe("parseBRL", () => {
  it("understands the usual Brazilian inputs", () => {
    expect(parseBRL("1.234,56")).toBe(123456)
    expect(parseBRL("45")).toBe(4500)
    expect(parseBRL("45,5")).toBe(4550)
    expect(parseBRL("R$ 12,90")).toBe(1290)
  })

  it("rejects invalid or negative input", () => {
    expect(parseBRL("")).toBeNull()
    expect(parseBRL("abc")).toBeNull()
    expect(parseBRL("-10")).toBeNull()
  })
})

describe("formatCompactBRL", () => {
  it("shortens thousands", () => {
    expect(formatCompactBRL(1250000)).toBe("R$ 12,5 mil")
    expect(formatCompactBRL(45000)).toBe("R$ 450")
  })
})
