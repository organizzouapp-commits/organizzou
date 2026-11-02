import { describe, expect, it } from "vitest"

import { classifyCapture, guessCategory, parseExpense } from "./rules"

describe("classifyCapture", () => {
  it("routes free text to the right module", () => {
    expect(classifyCapture("gastei 45 no mercado")).toBe("financas")
    expect(classifyCapture("estudei 2 horas de matemática")).toBe("estudos")
    expect(classifyCapture("terminei o treino de costas")).toBe("treinos")
    expect(classifyCapture("almocei arroz e frango")).toBe("dieta")
    expect(classifyCapture("pagar o aluguel sexta")).toBe("tarefas")
    expect(classifyCapture("")).toBeNull()
  })
})

describe("parsers", () => {
  it("reads the amount and the target of an expense", () => {
    expect(parseExpense("gastei R$ 80,50 de gasolina")).toEqual({ cents: 8050, what: "gasolina" })
    expect(parseExpense("gastei 45 no mercado")).toEqual({ cents: 4500, what: "mercado" })
    expect(parseExpense("bom dia")).toBeNull()
  })

  it("guesses a category from the description", () => {
    expect(guessCategory("mercado")).toBe("Mercado")
    expect(guessCategory("gasolina")).toBe("Transporte")
    expect(guessCategory("coisa qualquer")).toBe("Outros")
  })
})
