import { describe, expect, it } from "vitest"

import { maskPhone, PASSWORD_RULES, signInSchema, signUpSchema, toE164 } from "./schemas"

describe("signInSchema", () => {
  it("accepts a valid e-mail and password", () => {
    expect(signInSchema.safeParse({ email: "ana@exemplo.com", password: "x" }).success).toBe(true)
  })

  it("rejects an invalid e-mail", () => {
    expect(signInSchema.safeParse({ email: "ana", password: "x" }).success).toBe(false)
  })
})

describe("signUpSchema", () => {
  const base = {
    fullName: "Ana Souza",
    email: "ana@exemplo.com",
    phone: "(11) 91234-5678",
    password: "SenhaForte1",
  }

  it("accepts a complete valid form", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true)
  })

  it("explains each password rule in pt-BR", () => {
    const messages = (password: string) => {
      const result = signUpSchema.safeParse({ ...base, password })
      return result.success ? [] : result.error.issues.map((i) => i.message)
    }
    expect(messages("Ab1")).toContain("Use pelo menos 8 caracteres.")
    expect(messages("senhaforte1")).toContain("Inclua uma letra maiúscula.")
    expect(messages("SENHAFORTE1")).toContain("Inclua uma letra minúscula.")
    expect(messages("SenhaForte")).toContain("Inclua um número.")
  })

  it("rejects a short name and an invalid phone", () => {
    expect(signUpSchema.safeParse({ ...base, fullName: "A" }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...base, phone: "123" }).success).toBe(false)
  })
})

describe("password checklist", () => {
  it("reports which rules a password satisfies", () => {
    const passed = (value: string) => PASSWORD_RULES.filter((rule) => rule.test(value)).map((rule) => rule.key)
    expect(passed("abc")).toEqual(["lower"])
    expect(passed("SenhaForte1")).toEqual(["length", "upper", "lower", "digit"])
  })
})

describe("phone helpers", () => {
  it("masks Brazilian numbers while typing", () => {
    expect(maskPhone("11")).toBe("(11")
    expect(maskPhone("119123")).toBe("(11) 9123")
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678")
    expect(maskPhone("1131234567")).toBe("(11) 3123-4567")
  })

  it("converts to E.164 and rejects invalid numbers", () => {
    expect(toE164("(11) 91234-5678")).toBe("+5511912345678")
    expect(toE164("+55 11 3123-4567")).toBe("+551131234567")
    expect(toE164("(11) 81234-5678")).toBeNull()
    expect(toE164("(05) 91234-5678")).toBeNull()
    expect(toE164("12345")).toBeNull()
  })
})
