import { describe, expect, it } from "vitest"

import { GENERATOR_STRENGTH_LABELS, entropyBits, findReused, generatePassword, generatorEntropyBits, generatorPoolSize, passwordStrength, secureRandom, strengthFromBits } from "./passwords"

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

describe("generator entropy", () => {
  const all = { length: 20, upper: true, lower: true, digits: true, symbols: true }

  it("sums the sizes of the enabled sets", () => {
    expect(generatorPoolSize(all)).toBe(24 + 24 + 8 + 12)
    expect(generatorPoolSize({ upper: false, lower: false, digits: true, symbols: false })).toBe(8)
    expect(generatorPoolSize({ upper: false, lower: false, digits: false, symbols: false })).toBe(0)
  })

  it("is length times log2 of the pool size", () => {
    expect(generatorEntropyBits({ ...all, length: 20 })).toBe(Math.round(20 * Math.log2(68)))
    expect(generatorEntropyBits({ length: 12, upper: false, lower: false, digits: true, symbols: false })).toBe(36)
  })

  it("grows with the length and with every set that is turned on, and is zero with none", () => {
    expect(generatorEntropyBits({ ...all, length: 30 })).toBeGreaterThan(generatorEntropyBits({ ...all, length: 20 }))
    expect(generatorEntropyBits({ ...all, symbols: false })).toBeLessThan(generatorEntropyBits(all))
    expect(generatorEntropyBits({ length: 20, upper: false, lower: false, digits: false, symbols: false })).toBe(0)
  })

  it("maps bits to Fraca, Boa and Forte at 50 and 75", () => {
    expect([strengthFromBits(49), strengthFromBits(50), strengthFromBits(74), strengthFromBits(75)]).toEqual(["weak", "medium", "medium", "strong"])
    expect(GENERATOR_STRENGTH_LABELS).toEqual({ weak: "Fraca", medium: "Boa", strong: "Forte" })
    expect(strengthFromBits(generatorEntropyBits({ ...all, length: 8 }))).toBe("weak")
    expect(strengthFromBits(generatorEntropyBits({ ...all, length: 20 }))).toBe("strong")
  })
})

describe("secureRandom", () => {
  it("throws away draws from the uneven tail instead of using a modulo of them (no bias), and never touches Math.random", () => {
    const draws = [0xffffffff, 0xfffffffd, 7]
    let calls = 0
    const realDraw = crypto.getRandomValues
    const realRandom = Math.random
    crypto.getRandomValues = ((buffer: Uint32Array) => {
      buffer[0] = draws[calls++]
      return buffer
    }) as typeof crypto.getRandomValues
    Math.random = () => {
      throw new Error("Math.random must not be used")
    }
    try {
      expect(secureRandom(12)).toBe(7)
      expect(calls).toBe(3)
    } finally {
      crypto.getRandomValues = realDraw
      Math.random = realRandom
    }
  })

  it("stays inside [0, max)", () => {
    for (let i = 0; i < 500; i += 1) {
      const n = secureRandom(12)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(12)
    }
  })
})
