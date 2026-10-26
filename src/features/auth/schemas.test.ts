import { describe, expect, it } from "vitest"

import { signInSchema, signUpSchema } from "./schemas"

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
    displayName: "Ana",
    email: "ana@exemplo.com",
    password: "senha-forte-1",
    confirmPassword: "senha-forte-1",
  }

  it("accepts matching strong passwords", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true)
  })

  it("rejects short passwords", () => {
    expect(signUpSchema.safeParse({ ...base, password: "123", confirmPassword: "123" }).success).toBe(false)
  })

  it("rejects mismatched confirmation", () => {
    const result = signUpSchema.safeParse({ ...base, confirmPassword: "outra-senha-1" })
    expect(result.success).toBe(false)
  })
})
