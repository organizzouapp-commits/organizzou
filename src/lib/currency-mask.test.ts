import { describe, expect, it } from "vitest"

import { centsFromTyped, formatMasked, MAX_DIGITS, nextCentsFromTyping, parsePastedMoney } from "./currency-mask"

describe("formatMasked", () => {
  it("formats cents with dots and a decimal comma", () => {
    expect(formatMasked(0)).toBe("0,00")
    expect(formatMasked(5)).toBe("0,05")
    expect(formatMasked(1234567)).toBe("12.345,67")
    expect(formatMasked(100)).toBe("1,00")
    expect(formatMasked(429841)).toBe("4.298,41")
  })
  it("handles large values", () => {
    expect(formatMasked(123456789012)).toBe("1.234.567.890,12")
  })
})

describe("typing", () => {
  it("reads the digits as cents", () => {
    expect(centsFromTyped("1234567")).toBe(1234567)
    expect(centsFromTyped("12.345,67")).toBe(1234567)
    expect(centsFromTyped("")).toBeNull()
    expect(centsFromTyped("abc")).toBeNull()
  })
  it("typing one more digit shifts the value", () => {
    // "12,34" + "5" -> 1.234,5 -> digits 12345 -> 123,45
    expect(nextCentsFromTyping("12,34", "12,345")).toBe(12345)
  })
  it("backspace drops the last digit", () => {
    expect(nextCentsFromTyping("12.345,67", "12.345,6")).toBe(123456)
  })
  it("backspace down to zero empties the field, typing zero keeps it", () => {
    expect(nextCentsFromTyping("0,01", "0,0")).toBeNull()
    expect(nextCentsFromTyping("", "0")).toBe(0)
  })
  it("ignores digits past the limit", () => {
    expect(centsFromTyped("9".repeat(MAX_DIGITS + 5))).toBe(Number("9".repeat(MAX_DIGITS)))
  })
})

describe("parsePastedMoney", () => {
  it("accepts pt-BR and dot-decimal text", () => {
    expect(parsePastedMoney("1.234,56")).toBe(123456)
    expect(parsePastedMoney("1234.56")).toBe(123456)
    expect(parsePastedMoney("R$ 45")).toBe(4500)
    expect(parsePastedMoney("45,5")).toBe(4550)
  })
  it("reads a dot with three digits as thousands", () => {
    expect(parsePastedMoney("1.234")).toBe(123400)
    expect(parsePastedMoney("1.234.567")).toBe(123456700)
  })
  it("rejects text without an amount and negatives lose their sign", () => {
    expect(parsePastedMoney("abc")).toBeNull()
    expect(parsePastedMoney("")).toBeNull()
    expect(parsePastedMoney("-10,00")).toBe(1000)
  })
})

describe("signed amounts", () => {
  it("formats and types negatives", async () => {
    const { nextSignedCentsFromTyping } = await import("./currency-mask")
    expect(formatMasked(-123456)).toBe("-1.234,56")
    expect(nextSignedCentsFromTyping("1.234,56", "-1.234,56")).toBe(-123456)
    expect(nextSignedCentsFromTyping("-1.234,56", "-1.234,5")).toBe(-12345)
    expect(nextSignedCentsFromTyping("", "-")).toBeNull()
  })
})
