import { describe, expect, it } from "vitest"

import { entropyBits, findReused, generatePassword, passwordStrength } from "./passwords"

describe("passwordStrength", () => {
  it("flags short and common passwords as weak", () => {
    expect(passwordStrength("abc")).toBe("weak")
    expect(passwordStrength("senha12345")).toBe("weak")
    expect(passwordStrength("qwerty2024!")).toBe("weak")
  })

  it("rates longer mixed passwords higher", () => {
    expect(passwordStrength("Viagem@2024")).toBe("medium")
    expect(passwordStrength("r7#Kp9!vQ2$mZx4L")).toBe("strong")
  })

  it("grows entropy with length and variety", () => {
    expect(entropyBits("aaaaaaaa")).toBeLessThan(entropyBits("aA1!aA1!"))
    expect(entropyBits("")).toBe(0)
  })
})

describe("findReused", () => {
  it("groups items that share a password", () => {
    const groups = findReused([
      { id: "a", password: "x" },
      { id: "b", password: "y" },
      { id: "c", password: "x" },
      { id: "d" },
    ])
    expect(groups).toEqual([["a", "c"]])
  })
})

describe("generatePassword", () => {
  const all = { length: 20, upper: true, lower: true, digits: true, symbols: true }

  it("respects the length and includes every enabled set", () => {
    const password = generatePassword(all)
    expect(password).toHaveLength(20)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/\d/)
    expect(password).toMatch(/[^A-Za-z0-9]/)
  })

  it("only uses the enabled sets and returns empty when none is enabled", () => {
    expect(generatePassword({ ...all, upper: false, lower: false, symbols: false, length: 12 })).toMatch(/^\d{12}$/)
    expect(generatePassword({ length: 12, upper: false, lower: false, digits: false, symbols: false })).toBe("")
  })

  it("is deterministic with an injected random source", () => {
    const first = generatePassword(all, () => 0)
    const second = generatePassword(all, () => 0)
    expect(first).toBe(second)
  })
})
