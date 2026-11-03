import { describe, expect, it } from "vitest"

import { CONFIDENCE_THRESHOLD, extractWhen, parseCapture, splitItems, whenLabel } from "./parse"

// Monday, 2 Nov 2026, 10:00 in São Paulo.
const NOW = new Date("2026-11-02T13:00:00Z")
const one = (text: string) => parseCapture(text, NOW)[0]

describe("dates in America/Sao_Paulo", () => {
  it.each([
    ["sexta", "2026-11-06", undefined],
    ["amanhã 15h", "2026-11-03", "15:00"],
    ["dia 10", "2026-11-10", undefined],
    ["dia 1", "2026-12-01", undefined],
    ["25/12", "2026-12-25", undefined],
    ["hoje às 9h30", "2026-11-02", "09:30"],
    ["depois de amanhã", "2026-11-04", undefined],
    ["segunda", "2026-11-09", undefined],
    ["às 18", "2026-11-02", "18:00"],
  ])("%s", (text, day, time) => {
    const found = extractWhen(`ligar ${text}`, NOW)
    expect(found.day).toBe(day)
    expect(found.time).toBe(time)
    expect(found.rest).toBe("ligar")
  })
})

describe("what it creates", () => {
  it("task with a date", () => {
    expect(one("pagar aluguel sexta")).toMatchObject({ type: "tarefa", title: "Pagar aluguel", day: "2026-11-06" })
  })
  it("priority", () => {
    expect(one("enviar relatório amanhã urgente")).toMatchObject({ type: "tarefa", priority: "high", day: "2026-11-03", title: "Enviar relatório" })
  })
  it("expense with amount and category", () => {
    expect(one("gastei 45 no mercado")).toMatchObject({ type: "gasto", cents: 4500, title: "Mercado", category: "Mercado" })
    expect(one("gastei R$ 1.234,50 no restaurante")).toMatchObject({ type: "gasto", cents: 123450 })
  })
  it("income", () => {
    expect(one("recebi 3000 de salário")).toMatchObject({ type: "receita", cents: 300000 })
  })
  it("water, weight, sleep, mood", () => {
    expect(one("bebi 500 ml de água")).toMatchObject({ type: "agua", amount: 500 })
    expect(one("bebi 2 copos de água")).toMatchObject({ type: "agua", amount: 500 })
    expect(one("pesei 72,4")).toMatchObject({ type: "peso", amount: 72.4 })
    expect(one("dormi 7 horas")).toMatchObject({ type: "sono", amount: 7 })
    expect(one("humor 4")).toMatchObject({ type: "humor", amount: 4 })
  })
  it("study and workout", () => {
    expect(one("estudei 1 hora de estatística")).toMatchObject({ type: "estudo", amount: 60, target: "estatística" })
    expect(one("treinei peito 50 min")).toMatchObject({ type: "treino", amount: 50, target: "peito" })
  })
  it("event, reminder, goal, note, habit", () => {
    expect(one("reunião com a Marina amanhã 15h")).toMatchObject({ type: "evento", day: "2026-11-03", time: "15:00" })
    expect(one("me lembra de ligar para o contador sexta")).toMatchObject({ type: "lembrete", title: "Ligar para o contador", day: "2026-11-06" })
    expect(one("meta de ler 12 livros")).toMatchObject({ type: "meta", title: "Ler 12 livros" })
    expect(one("anota que a senha do wifi mudou")).toMatchObject({ type: "nota", title: "A senha do wifi mudou" })
    expect(one("criar hábito de meditar")).toMatchObject({ type: "habito", title: "Meditar" })
  })
})

describe("several items in one text", () => {
  it("splits on 'e' before a verb", () => {
    expect(splitItems("pagar aluguel sexta e comprar pão")).toEqual(["pagar aluguel sexta", "comprar pão"])
    const items = parseCapture("pagar aluguel sexta e comprar pão", NOW)
    expect(items.map((i) => [i.type, i.title])).toEqual([["tarefa", "Pagar aluguel"], ["tarefa", "Comprar pão"]])
  })
  it("does not split a single sentence", () => {
    expect(splitItems("comprar pão e leite")).toEqual(["comprar pão e leite"])
  })
  it("mixed kinds", () => {
    const items = parseCapture("gastei 30 na padaria; bebi 300 ml de água", NOW)
    expect(items.map((i) => i.type)).toEqual(["gasto", "agua"])
  })
})

describe("unsure text is never dropped", () => {
  it("keeps it as a low-confidence note", () => {
    const item = one("aquele negócio do João")
    expect(item.type).toBe("nota")
    expect(item.confidence).toBeLessThan(CONFIDENCE_THRESHOLD)
    expect(item.source).toBe("aquele negócio do João")
  })
  it("whenLabel", () => {
    expect(whenLabel({ day: "2026-11-02", time: "09:00" }, NOW)).toBe("hoje · 09:00")
    expect(whenLabel({ day: "2026-11-06" }, NOW)).toBe("sexta")
  })
})
