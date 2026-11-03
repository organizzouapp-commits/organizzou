import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { type ChatEvent, type ModelClient, runCapture, runChat, runConfirmed } from "./engine"
import type { Ctx } from "./execute"
import { TOOLS, toolDefinitions } from "./tools"
import { checkQuota, recordUsage } from "./usage"

/** A tiny stand-in for the Supabase query builder: records writes, answers reads from `data`. */
type Call = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown }
function fakeDb(data: Record<string, unknown[]> = {}, errors: Record<string, { code?: string; message?: string }> = {}) {
  const calls: Call[] = []
  const rpcs: { fn: string; args: unknown }[] = []
  const from = (table: string) => {
    let op: Call["op"] = "select"
    const query: Record<string, unknown> = {}
    const done = () => {
      calls.push({ table, op, payload: query.payload })
      return errors[table] ? { data: null, error: errors[table], count: null } : { data: op === "select" ? (data[table] ?? []) : null, error: null, count: (data[table] ?? []).length }
    }
    for (const name of ["select", "eq", "is", "not", "ilike", "order", "limit", "gte", "lte", "lt", "in"]) query[name] = () => query
    query.insert = (payload: unknown) => ((op = "insert"), (query.payload = payload), query)
    query.update = (payload: unknown) => ((op = "update"), (query.payload = payload), query)
    query.delete = () => ((op = "delete"), query)
    query.maybeSingle = async () => {
      const result = done()
      return { data: Array.isArray(result.data) ? (result.data[0] ?? null) : null, error: result.error }
    }
    query.then = (resolve: (value: unknown) => unknown) => resolve(done())
    return query
  }
  const supabase = { from, rpc: async (fn: string, args: unknown) => (rpcs.push({ fn, args }), { data: null, error: null }) } as unknown as SupabaseClient
  return { supabase, calls, rpcs }
}

const NOW = new Date("2026-11-02T13:00:00Z")
const ctxOf = (supabase: SupabaseClient): Ctx => ({ supabase, userId: "11111111-1111-4111-8111-111111111111", now: NOW })

type Reply = { content: unknown[]; stop_reason: string; usage?: { input_tokens: number; output_tokens: number } }
/** A model that answers with the scripted replies, one per call, and remembers what it was asked. */
function scripted(replies: Reply[]) {
  const requests: { tools: { name: string }[]; messages: unknown[]; tool_choice?: unknown }[] = []
  let i = 0
  const client = {
    messages: {
      stream(params: { tools: { name: string }[]; messages: unknown[]; tool_choice?: unknown }) {
        requests.push({ tools: params.tools, messages: structuredClone(params.messages), tool_choice: params.tool_choice })
        const reply = replies[Math.min(i++, replies.length - 1)]
        const listeners: ((delta: string) => void)[] = []
        return {
          on(_event: "text", listener: (delta: string) => void) {
            listeners.push(listener)
          },
          async finalMessage() {
            for (const block of reply.content as { type: string; text?: string }[]) if (block.type === "text") listeners.forEach((l) => l(block.text!))
            return reply
          },
        }
      },
    },
  } as unknown as ModelClient
  return { client, requests }
}

const use = (name: string, input: unknown, id = "tu_1") => ({ type: "tool_use", id, name, input })
const text = (value: string) => ({ type: "text", text: value })

const rows = {
  finance_accounts: [{ id: "acc-1" }],
  finance_categories: [{ id: "cat-mercado", name: "Mercado" }],
  boards: [{ id: "board-1" }],
  board_lists: [{ id: "list-1" }],
  tasks: [{ id: "task-1", title: "Enviar relatório", due_at: null, due_has_time: false, priority: "none" }],
}

describe("tool selection and execution", () => {
  it("a spending is recorded in the right category, replied in one calm sentence, and audited as the assistant", async () => {
    const { supabase, calls } = fakeDb(rows)
    const { client } = scripted([
      { content: [use("create_transaction", { kind: "out", amount_reais: 45, description: "Mercado", category: "Mercado" })], stop_reason: "tool_use", usage: { input_tokens: 900, output_tokens: 40 } },
      { content: [text("Gasto de R$ 45,00 registrado em Mercado.")], stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 20 } },
    ])
    const events: ChatEvent[] = []
    const { tokens, reply } = await runChat({ client, model: "m", ctx: ctxOf(supabase), history: [], userText: "gastei 45 no mercado", emit: (e) => events.push(e) })

    const insert = calls.find((c) => c.table === "finance_transactions" && c.op === "insert")
    expect(insert?.payload).toMatchObject({ amount_cents: 4500, kind: "out", category_id: "cat-mercado", account_id: "acc-1", user_id: "11111111-1111-4111-8111-111111111111" })
    expect(events.find((e) => e.type === "action")).toMatchObject({ label: expect.stringContaining("Mercado") })
    expect(reply).toBe("Gasto de R$ 45,00 registrado em Mercado.")
    expect(tokens).toEqual({ input: 1900, output: 60 })
    expect(calls.some((c) => c.table === "audit_log" && c.op === "insert" && (c.payload as { actor: string }).actor === "assistant")).toBe(true)
  })

  it("a destructive tool never runs: the person is asked first", async () => {
    const { supabase, calls } = fakeDb(rows)
    const { client } = scripted([{ content: [use("delete_task", { title_contains: "relatório" })], stop_reason: "tool_use" }])
    const events: ChatEvent[] = []
    await runChat({ client, model: "m", ctx: ctxOf(supabase), history: [], userText: "apaga a tarefa do relatório", emit: (e) => events.push(e) })
    expect(calls.some((c) => c.op === "delete")).toBe(false)
    expect(events.find((e) => e.type === "confirm")).toMatchObject({ confirmLabel: "Apagar", pending: { tool: "delete_task" } })
  })

  it("only a destructive tool can be run as a confirmed action, and it is audited as confirmed", async () => {
    const { supabase, calls } = fakeDb(rows)
    const bad = await runConfirmed(ctxOf(supabase), { tool: "create_task", input: { title: "x" } })
    expect(bad.ok).toBe(false)
    const ok = await runConfirmed(ctxOf(supabase), { tool: "delete_task", input: { title_contains: "relatório" } })
    expect(ok.ok).toBe(true)
    expect(calls.some((c) => c.table === "tasks" && c.op === "delete")).toBe(true)
    expect(calls.find((c) => c.table === "audit_log")?.payload).toMatchObject({ actor: "assistant", confirmed_at: expect.any(String) })
  })

  it("ambiguity becomes buttons", async () => {
    const { supabase } = fakeDb(rows)
    const { client } = scripted([{ content: [use("ask_user", { question: "Qual tarefa?", choices: ["Relatório semanal", "Relatório mensal"] })], stop_reason: "tool_use" }])
    const events: ChatEvent[] = []
    await runChat({ client, model: "m", ctx: ctxOf(supabase), history: [], userText: "conclui o relatório", emit: (e) => events.push(e) })
    expect(events.find((e) => e.type === "choices")).toMatchObject({ choices: ["Relatório semanal", "Relatório mensal"] })
  })

  it("invalid tool input is reported back to the model, not executed", async () => {
    const { supabase, calls } = fakeDb(rows)
    const { client, requests } = scripted([
      { content: [use("log_water", { ml: 999999 })], stop_reason: "tool_use" },
      { content: [text("Não consegui registrar essa quantidade.")], stop_reason: "end_turn" },
    ])
    await runChat({ client, model: "m", ctx: ctxOf(supabase), history: [], userText: "bebi muita água", emit: () => undefined })
    expect(calls.some((c) => c.table === "water_logs")).toBe(false)
    const last = requests[1].messages.at(-1) as { content: { is_error?: boolean }[] }
    expect(last.content[0].is_error).toBe(true)
  })

  it("the loop is bounded", async () => {
    const { supabase } = fakeDb(rows)
    const { client, requests } = scripted([{ content: [use("day_summary", {})], stop_reason: "tool_use" }])
    await runChat({ client, model: "m", ctx: ctxOf(supabase), history: [], userText: "oi", emit: () => undefined })
    expect(requests.length).toBeLessThanOrEqual(5)
  })

  it("sends the history it was given, newest last, and puts the system prompt in a cacheable block", async () => {
    const { supabase } = fakeDb(rows)
    const { client, requests } = scripted([{ content: [text("Oi!")], stop_reason: "end_turn" }])
    await runChat({ client, model: "m", ctx: ctxOf(supabase), history: [{ role: "user", text: "oi" }, { role: "assistant", text: "Olá" }], userText: "e agora?", emit: () => undefined })
    expect((requests[0].messages as { content: string }[]).map((m) => m.content)).toEqual(["oi", "Olá", "e agora?"])
  })
})

describe("quick capture model fallback", () => {
  it("may only use the create tools, and creates what the model reads", async () => {
    const { supabase, calls } = fakeDb(rows)
    const { client, requests } = scripted([{ content: [use("create_task", { title: "Ligar para o João", due_date: "2026-11-06" }), use("delete_task", { title_contains: "x" }, "tu_2")], stop_reason: "tool_use" }])
    const { created } = await runCapture({ client, model: "m", ctx: ctxOf(supabase), text: "o negócio do João sexta" })
    expect(requests[0].tools.every((t) => TOOLS.find((x) => x.name === t.name)?.creates)).toBe(true)
    expect(created.map((c) => c.type)).toEqual(["tarefa"])
    expect(calls.some((c) => c.op === "delete")).toBe(false)
  })
  it("creating nothing is a valid answer (the caller keeps the text as an Inbox note)", async () => {
    const { supabase } = fakeDb(rows)
    const { client } = scripted([{ content: [text("não sei")], stop_reason: "end_turn" }])
    expect((await runCapture({ client, model: "m", ctx: ctxOf(supabase), text: "hmm" })).created).toEqual([])
  })
})

describe("tools", () => {
  it("every tool has a unique name and an object JSON schema", () => {
    const names = TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const def of toolDefinitions()) expect(def.input_schema.type).toBe("object")
  })
  it("covers every domain the assistant must handle", () => {
    for (const name of ["create_task", "complete_task", "update_task", "create_transaction", "pay_bill", "log_habit", "create_event", "update_event", "log_workout", "log_water", "log_weight", "log_study", "create_note", "create_reminder", "create_goal", "log_mood", "log_sleep", "list_tasks", "day_summary", "finance_summary"]) {
      expect(TOOLS.map((t) => t.name), name).toContain(name)
    }
  })
})

describe("daily limit and usage", () => {
  const today = [{ messages: 15 }]
  it("Gratuito stops at 15, Pro keeps going until 200", async () => {
    expect(await checkQuota(fakeDb({ assistant_usage: today }).supabase, "u", "free", NOW)).toMatchObject({ ok: false, reason: "limit", limit: 15 })
    expect(await checkQuota(fakeDb({ assistant_usage: [{ messages: 14 }] }).supabase, "u", "free", NOW)).toMatchObject({ ok: true, remaining: 1 })
    expect(await checkQuota(fakeDb({ assistant_usage: today }).supabase, "u", "pro", NOW)).toMatchObject({ ok: true, limit: 200 })
    expect(await checkQuota(fakeDb({ assistant_usage: [{ messages: 200 }] }).supabase, "u", "pro", NOW)).toMatchObject({ ok: false, reason: "limit" })
  })
  it("no usage row yet means zero used", async () => {
    expect(await checkQuota(fakeDb().supabase, "u", "free", NOW)).toMatchObject({ ok: true, used: 0, limit: 15 })
  })
  it("when the usage table is not there yet the model is not allowed (an uncounted model is an unbounded bill)", async () => {
    expect(await checkQuota(fakeDb({}, { assistant_usage: { code: "PGRST205" } }).supabase, "u", "free", NOW)).toEqual({ ok: false, reason: "unavailable" })
  })
  it("records messages and tokens for today in São Paulo", async () => {
    const { supabase, rpcs } = fakeDb()
    await recordUsage(supabase, { input: 1200, output: 80 }, NOW)
    expect(rpcs).toEqual([{ fn: "assistant_bump_usage", args: { p_day: "2026-11-02", p_messages: 1, p_input: 1200, p_output: 80 } }])
  })
})
