import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { COMPARISON } from "./plan-comparison"

const row = (label: string) => COMPARISON.flatMap((g) => g.rows).find((r) => r.label === label)

describe("the comparison table", () => {
  it("is grouped as the design: Tarefas, Finanças, Assistente, Módulos de vida, Segurança e avisos", () => {
    expect(COMPARISON.map((g) => g.title)).toEqual(["Tarefas", "Finanças", "Assistente", "Módulos de vida", "Segurança e avisos"])
  })
  it("Free has 1 board and up to 3 lists, Pro is unlimited", () => {
    expect(row("Quadros")).toMatchObject({ free: "1", pro: "Ilimitados" })
    expect(row("Listas")).toMatchObject({ free: "Até 3", pro: "Ilimitadas" })
  })
  it("the assistant: Gratuito dash, Pro conversation, actions and voice, 200 a day; no quick-capture row, no audio row", () => {
    expect(row("Assistente virtual")).toEqual({ label: "Assistente virtual", free: "—", pro: "Conversa, ações e voz · 200 por dia" })
    const labels = COMPARISON.flatMap((g) => g.rows).map((r) => r.label.toLowerCase())
    expect(labels.some((l) => l.includes("captura") || l.includes("áudio") || l.includes("audio"))).toBe(false)
  })
  it("finance: manual entries are free, the rest is Pro", () => {
    expect(row("Lançamentos manuais")).toMatchObject({ free: true, pro: true })
    for (const label of ["Contas fixas e parceladas", "Metas e orçamento", "Gráficos e histórico"]) expect(row(label)).toMatchObject({ free: false, pro: true })
  })
  it("the life modules are Pro, and the message service is only a badge under Pro", () => {
    expect(row("Agenda, Rotina, Treinos, Dieta, Estudos, Notas, Metas, Diário e Cofre")).toMatchObject({ free: false, pro: true })
    expect(row("WhatsApp")).toEqual({ label: "WhatsApp", free: false, pro: "soon" })
  })
})

describe("the plan screen copy", () => {
  const screen = readFileSync(join(process.cwd(), "src/components/plan/plano-screen.tsx"), "utf8")
  it("has the launch offer, the three plans, the best-value badge, the guarantees and the Pro cards", () => {
    for (const text of ["Pro por {launchPriceText()} no 1º mês", "Experimentar por {launchPriceText()}", "Pro Mensal", "Pro Anual", "Melhor valor", "Pagamento seguro pelo Asaas", "Cancelar assinatura", "Mudar para o anual", "Faturas", "Forma de pagamento"]) expect(screen).toContain(text)
  })
  it("never talks to the payment provider from the browser: only our own routes", () => {
    const files = ["plano-screen.tsx", "checkout-dialog.tsx", "plan-dialogs.tsx", "use-billing.ts"].map((f) => readFileSync(join(process.cwd(), "src/components/plan", f), "utf8")).join("\n")
    expect(files).not.toMatch(/asaas\.com|ASAAS_API_KEY|access_token/)
    for (const route of ["/api/billing/checkout", "/api/billing/status", "/api/billing/cancel", "/api/billing/change-plan", "/api/billing/invoices"]) expect(files).toContain(route)
  })
})
