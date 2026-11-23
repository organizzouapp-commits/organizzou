import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ plan: "free" as "free" | "pro", modelCreated: 0, runCapture: 0 }))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock("@/lib/plan-server", () => ({ getUserPlan: async () => state.plan }))
vi.mock("@/lib/supabase/session", () => ({ getSession: async () => ({ supabase: {}, userId: "u1" }) }))
vi.mock("@/server/assistant/usage", () => ({
  assistantModel: () => "m",
  checkQuota: async () => ({ ok: true, used: 0, limit: 200, remaining: 200 }),
  recordUsage: async () => undefined,
}))
vi.mock("@/server/assistant/engine", () => ({
  createModelClient: () => (state.modelCreated++, {}),
  runCapture: async () => (state.runCapture++, { created: [], tokens: { input: 1, output: 1 } }),
}))
vi.mock("@/server/assistant/execute", () => ({
  auditCreated: async () => undefined,
  createFromItem: async () => ({ ok: false, reason: "x" }),
  saveToInbox: async () => ({ ok: true, created: { id: "n1", label: "Nota", href: "/notas", undo: [], type: "nota" } }),
  undoSteps: async () => ({ ok: true }),
}))

import { captureQuick } from "./actions"
import { PLANS, canUseAssistant } from "@/lib/plans"

beforeEach(() => {
  state.modelCreated = 0
  state.runCapture = 0
})

describe("the assistant is Pro only", () => {
  it("Free: the free-text capture never reaches the Anthropic client, unsure text is kept as an Inbox note", async () => {
    state.plan = "free"
    const result = await captureQuick({ text: "alguma coisa solta que as regras não entendem xyzzy" })
    expect(result.ok).toBe(true)
    expect(state.modelCreated).toBe(0)
    expect(state.runCapture).toBe(0)
  })
  it("Pro: the model fallback still runs", async () => {
    state.plan = "pro"
    await captureQuick({ text: "alguma coisa solta que as regras não entendem xyzzy" })
    expect(state.runCapture).toBe(1)
  })
  it("the plan table has no Free assistant messages and the copy has no quick-capture mode", () => {
    expect(canUseAssistant("free")).toBe(false)
    expect(PLANS.free.limits.assistantMessagesPerDay).toBe(0)
    expect(PLANS.pro.limits.assistantMessagesPerDay).toBe(200)
    expect(PLANS.free.features.join(" ")).not.toMatch(/assistente|mensagens/i)
    expect(PLANS.pro.features.join(" ")).toMatch(/onversa, ações e voz · 200 mensagens por dia/)
  })
})

describe("server and screen", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
  it("the chat route refuses non-Pro before it creates the model client, with a code the screen maps", () => {
    const route = read("src/app/api/assistant/chat/route.ts")
    expect(route).toMatch(/code: "pro_only"/g)
    const post = route.slice(route.indexOf("export async function POST"))
    expect(post.indexOf("canUseAssistant(plan)")).toBeGreaterThan(-1)
    expect(post.indexOf("canUseAssistant(plan)")).toBeLessThan(post.indexOf("createModelClient()"))
  })
  it("the locked panel shows the Pro pitch, links to Plano e cobrança and the sheet does not fetch for Free", () => {
    const sheet = read("src/components/assistant/assistant-sheet.tsx")
    expect(sheet).toContain("O assistente faz parte do Pro")
    expect(sheet).toContain("Criar tarefas e eventos por texto ou voz")
    expect(sheet).toContain("Consultar suas finanças e metas")
    expect(sheet).toContain("Lançar gastos conversando")
    expect(sheet).toContain("Conhecer o Pro")
    expect(sheet).toContain("Agora não")
    expect(sheet).toMatch(/if \(!open \|\| locked\) return/)
    expect(sheet).not.toMatch(/Captura rápida/i)
  })
  it("the comparison table says — for Free and the Pro assistant row, and no audio badge", () => {
    const screen = read("src/components/plan/plan-comparison.tsx")
    expect(screen).toContain('free: "—"')
    expect(screen).toContain("Conversa, ações e voz · 200 por dia")
    expect(screen).not.toMatch(/udio[^\n]*Em breve|Captura/)
  })
})
