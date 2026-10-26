import { describe, expect, it } from "vitest"

import { buildReply, classifyCapture, guessCategory, parseDueOffset, parseExpense } from "./assistant"

// Tuesday 2026-03-10, noon in São Paulo
const NOW = "2026-03-10T15:00:00.000Z"

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

  it("resolves relative due words", () => {
    expect(parseDueOffset("pagar o aluguel amanhã", 2)).toBe(1)
    expect(parseDueOffset("entregar sexta", 2)).toBe(3)
    expect(parseDueOffset("sem data", 2)).toBeNull()
  })
})

describe("buildReply", () => {
  it("confirms an expense and offers to undo it", () => {
    const reply = buildReply("Gastei 45 no mercado", NOW)
    expect(reply.text).toBe("Gasto de R$ 45,00 registrado em Mercado.")
    expect(reply.action?.undoable).toBe(true)
  })

  it("asks before saving when the input is ambiguous", () => {
    const reply = buildReply("terminei o treino", NOW)
    expect(reply.choices).toHaveLength(3)
    expect(reply.action).toBeUndefined()
  })

  it("asks for confirmation before deleting", () => {
    const reply = buildReply("apagar a tarefa de pagar IPTU", NOW)
    expect(reply.confirm).toBeDefined()
    expect(reply.action).toBeUndefined()
  })

  it("never touches the vault", () => {
    expect(buildReply("qual é minha senha do Gmail?", NOW).text).toMatch(/não tenho acesso ao cofre/i)
  })

  it("answers summaries with data rows", () => {
    expect(buildReply("quanto gastei este mês?", NOW).rows?.length).toBeGreaterThan(2)
  })
})
