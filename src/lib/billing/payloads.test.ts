import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { dayOf } from "@/lib/sp-time"

import { messageFor, sanitizeDescription, specificMessage } from "./asaas"
import { buildCustomerBody, buildPaymentUpdate, buildSubscriptionBody, compact, plainText } from "./payloads"
import { quote } from "./pricing"

const USER = "7b9f1c2e-1111-4222-8333-444455556666"
const today = "2026-11-23"
const body = (period: "monthly" | "annual", method: "pix" | "boleto" | "card") => buildSubscriptionBody({ customerId: "cus_1", method, quote: quote(period, method, today, true), today, userId: USER })

describe("the exact subscription body", () => {
  it("monthly Pix", () => {
    expect(body("monthly", "pix")).toEqual({ customer: "cus_1", billingType: "PIX", value: 24.9, nextDueDate: "2026-11-23", cycle: "MONTHLY", description: "Organizzou Pro - plano mensal", externalReference: USER })
  })
  it("monthly boleto", () => {
    expect(body("monthly", "boleto")).toEqual({ customer: "cus_1", billingType: "BOLETO", value: 24.9, nextDueDate: "2026-11-23", cycle: "MONTHLY", description: "Organizzou Pro - plano mensal", externalReference: USER })
  })
  it("monthly card (no card fields: the card is typed on the Asaas page)", () => {
    expect(body("monthly", "card")).toEqual({ customer: "cus_1", billingType: "CREDIT_CARD", value: 24.9, nextDueDate: "2026-11-23", cycle: "MONTHLY", description: "Organizzou Pro - plano mensal", externalReference: USER })
  })
  it("annual Pix", () => {
    expect(body("annual", "pix")).toEqual({ customer: "cus_1", billingType: "PIX", value: 250, nextDueDate: "2026-11-23", cycle: "YEARLY", description: "Organizzou Pro - plano anual", externalReference: USER })
  })
  it("only valid fields, valid types: no callback, discount, fine, interest, creditCard, null, undefined or empty value", () => {
    for (const period of ["monthly", "annual"] as const)
      for (const method of ["pix", "boleto", "card"] as const) {
        const b = body(period, method) as Record<string, unknown>
        expect(Object.keys(b).sort()).toEqual(["billingType", "customer", "cycle", "description", "externalReference", "nextDueDate", "value"])
        for (const value of Object.values(b)) expect(value === null || value === undefined || value === "").toBe(false)
        expect(typeof b.value).toBe("number")
        expect(b.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(b.description as string).toMatch(/^[\x20-\x7e]+$/)
        expect(JSON.parse(JSON.stringify(b))).toEqual(b) // survives the trip to JSON untouched
      }
  })
  it("the value is a number, never a string with a comma", () => {
    expect(JSON.stringify(body("monthly", "pix"))).toContain('"value":24.9')
    expect(JSON.stringify(body("annual", "pix"))).toContain('"value":250')
  })
  it("refuses a malformed date or a missing customer instead of sending them", () => {
    expect(() => buildSubscriptionBody({ customerId: "cus_1", method: "pix", quote: quote("monthly", "pix", today), today: "23/11/2026", userId: USER })).toThrow()
    expect(() => buildSubscriptionBody({ customerId: "", method: "pix", quote: quote("monthly", "pix", today), today, userId: USER })).toThrow()
  })
})

describe("the due date is the day in Sao Paulo, not in UTC", () => {
  it("2026-11-24T01:00:00Z is still 23/11 in Sao Paulo", () => {
    expect(new Date("2026-11-24T01:00:00Z").toISOString().slice(0, 10)).toBe("2026-11-24") // the UTC day we must NOT send
    expect(dayOf(new Date("2026-11-24T01:00:00Z"), 0)).toBe("2026-11-23")
  })
  it("just after midnight in Sao Paulo it is the next day, and 02:59 UTC is not yet", () => {
    expect(dayOf(new Date("2026-11-24T02:59:00Z"), 0)).toBe("2026-11-23")
    expect(dayOf(new Date("2026-11-24T03:00:00Z"), 0)).toBe("2026-11-24")
  })
})

describe("the customer body", () => {
  it("document as digits only, e-mail trimmed and lower case, a name that is never empty", () => {
    expect(buildCustomerBody({ name: "  Ana   Souza ", cpfCnpj: "529.982.247-25", email: " Ana@Exemplo.COM ", userId: USER })).toEqual({ name: "Ana Souza", cpfCnpj: "52998224725", email: "ana@exemplo.com", externalReference: USER })
    expect(buildCustomerBody({ name: "", cpfCnpj: "11.222.333/0001-81", email: "bia@exemplo.com", userId: USER }).name).toBe("bia")
    expect(buildCustomerBody({ name: "   ", cpfCnpj: "52998224725", email: "", userId: USER }).name).toBe("Cliente Organizzou")
  })
  it("sends only the four documented fields (no notificationDisabled)", () => {
    expect(Object.keys(buildCustomerBody({ name: "Ana", cpfCnpj: "52998224725", email: "a@b.co", userId: USER })).sort()).toEqual(["cpfCnpj", "email", "externalReference", "name"])
  })
})

describe("helpers", () => {
  it("compact drops undefined, null and empty strings and keeps zero and false", () => {
    expect(compact({ a: 1, b: undefined, c: null, d: "", e: 0, f: false })).toEqual({ a: 1, e: 0, f: false })
  })
  it("plain text: no accents or symbols, single spaces, capped", () => {
    expect(plainText("Organizzou Pro · plano  mensal – 1º mês", 100)).toBe("Organizzou Pro plano mensal 1 mes")
    expect(plainText("x".repeat(300), 100)).toHaveLength(100)
  })
  it("the first-charge edit sends the three fields Asaas asks for, in plain text", () => {
    expect(buildPaymentUpdate({ method: "pix", cents: 490, dueDate: "2026-11-23", description: "Organizzou Pro - plano mensal (1o mes)" })).toEqual({ billingType: "PIX", value: 4.9, dueDate: "2026-11-23", description: "Organizzou Pro - plano mensal (1o mes)" })
  })
})

describe("what is logged and what the person reads", () => {
  it("validation descriptions are cleaned: no e-mail, CPF, CNPJ, token; at most 200 characters", () => {
    expect(sanitizeDescription("O campo callback.successUrl é inválido")).toBe("O campo callback.successUrl é inválido")
    expect(sanitizeDescription("CPF 529.982.247-25 inválido para ana@exemplo.com")).toBe("CPF [documento] inválido para [email]")
    expect(sanitizeDescription("CNPJ 11.222.333/0001-81 e 52998224725 e 11222333000181")).toBe("CNPJ [documento] e [documento] e [documento]")
    expect(sanitizeDescription("token $aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwNzQwMDI6OiRhYWNoXzdlZmU")).toBe("token [token]")
    expect(sanitizeDescription("a".repeat(500).replace(/a/g, "ab ")).length).toBeLessThanOrEqual(200)
    expect(sanitizeDescription(undefined)).toBe("")
  })
  it("known descriptions map to a specific message, others stay generic", () => {
    expect(specificMessage(["O CPF/CNPJ informado é inválido."])).toBe("CPF ou CNPJ inválido. Confira os números e tente de novo.")
    expect(specificMessage(["O e-mail informado é inválido."])).toBe("E-mail inválido. Confira o e-mail da sua conta.")
    expect(specificMessage(["O campo nome é obrigatório."])).toBe("O nome da conta está incompleto. Complete seu nome no perfil e tente de novo.")
    expect(specificMessage(["O campo X é inválido"])).toBeNull()
    expect(messageFor(400, ["invalid_object"], ["O campo X é inválido"])).toMatch(/recusou o pedido/)
    expect(messageFor(400, ["invalid_object"], ["O CPF/CNPJ informado é inválido."])).toMatch(/^CPF ou CNPJ inválido/)
    expect(messageFor(500, [], ["cpf"])).toMatch(/instável/) // a server error never blames the person's data
  })
})
