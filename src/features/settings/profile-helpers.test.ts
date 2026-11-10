import { describe, expect, it } from "vitest"

import { canChangePassword, isProfileDirty, memberSince, passwordRequirements, passwordStrength, profileInitials } from "./profile-helpers"

// Fake strings only.
describe("passwordRequirements", () => {
  it("lists the four rules in order", () => {
    expect(passwordRequirements("").map((r) => r.label)).toEqual(["Mínimo de 8 caracteres", "Letra maiúscula", "Letra minúscula", "Número"])
    expect(passwordRequirements("").every((r) => !r.met)).toBe(true)
  })

  it("marks each rule as it is met", () => {
    const met = (value: string) => passwordRequirements(value).map((r) => r.met)
    expect(met("abcdefgh")).toEqual([true, false, true, false])
    expect(met("ABCDEFGH")).toEqual([true, true, false, false])
    expect(met("Ab1")).toEqual([false, true, true, true])
    expect(met("Abcdef12")).toEqual([true, true, true, true])
  })
})

describe("passwordStrength", () => {
  it("is empty for nothing", () => {
    expect(passwordStrength("")).toEqual({ level: "empty", label: "—", percent: 0 })
  })

  it("is weak while a rule is missing, and grows with the rules met", () => {
    expect(passwordStrength("abc").level).toBe("weak")
    expect(passwordStrength("abcdefgh").level).toBe("weak")
    expect(passwordStrength("abcdefg1").percent).toBeGreaterThan(passwordStrength("abcdefgh").percent)
    expect(passwordStrength("Abcdefgh").label).toBe("Fraca")
  })

  it("is medium when all four rules are met but the password is short", () => {
    expect(passwordStrength("Abcdef12")).toEqual({ level: "medium", label: "Média", percent: 66 })
  })

  it("is strong with 12 or more characters, or 10 with a symbol", () => {
    expect(passwordStrength("Abcdefgh1234").level).toBe("strong")
    expect(passwordStrength("Abcdefg1!x").level).toBe("strong")
    expect(passwordStrength("Abcdefg1x").level).toBe("medium")
  })
})

describe("canChangePassword", () => {
  it("needs every rule and a matching confirmation", () => {
    expect(canChangePassword("Abcdef12", "Abcdef12")).toBe(true)
    expect(canChangePassword("Abcdef12", "Abcdef13")).toBe(false)
    expect(canChangePassword("Abcdef12", "")).toBe(false)
    expect(canChangePassword("abcdef12", "abcdef12")).toBe(false)
    expect(canChangePassword("", "")).toBe(false)
  })

  it("refuses more than 72 characters (the server limit)", () => {
    const long = `Aa1${"x".repeat(70)}`
    expect(canChangePassword(long, long)).toBe(false)
  })
})

describe("profileInitials", () => {
  it("uses the first and last name", () => {
    expect(profileInitials("João Pedro da Silva")).toBe("JS")
    expect(profileInitials("maria")).toBe("M")
    expect(profileInitials("  ana   luiza ")).toBe("AL")
  })

  it("falls back to the e-mail, then to a question mark", () => {
    expect(profileInitials("", "zeca@exemplo.com")).toBe("Z")
    expect(profileInitials("   ")).toBe("?")
  })
})

describe("memberSince", () => {
  it("says the month and year of the account", () => {
    expect(memberSince("2026-11-10T15:00:00.000Z")).toBe("novembro 2026")
    expect(memberSince("2024-03-05T12:00:00.000Z")).toBe("março 2024")
  })

  it("uses the Brazilian calendar at the edge of a month", () => {
    expect(memberSince("2026-12-01T01:00:00.000Z")).toBe("novembro 2026")
  })

  it("is null without a valid date", () => {
    expect(memberSince(null)).toBeNull()
    expect(memberSince("")).toBeNull()
    expect(memberSince("ontem")).toBeNull()
  })
})

describe("isProfileDirty", () => {
  const saved = { name: "Ana Souza", phone: "(11) 91234-5678" }
  it("is false for the saved values, even with stray spaces", () => {
    expect(isProfileDirty(saved, { ...saved })).toBe(false)
    expect(isProfileDirty(saved, { name: " Ana Souza ", phone: saved.phone })).toBe(false)
  })
  it("is true when the name or the phone changes", () => {
    expect(isProfileDirty(saved, { ...saved, name: "Ana" })).toBe(true)
    expect(isProfileDirty(saved, { ...saved, phone: "" })).toBe(true)
  })
})
