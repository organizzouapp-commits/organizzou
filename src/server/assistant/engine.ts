import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { auditCreated, type Created, type Ctx } from "./execute"
import { MAX_OUTPUT_TOKENS, MAX_TOOL_STEPS } from "./usage"
import { type Tool, TOOLS, toolByName, toolDefinitions } from "./tools"

/**
 * The assistant engine, shared by the app chat and quick capture. It runs a bounded tool-use
 * loop against the Anthropic API on the person's own session; the API key comes from the environment and never leaves the server.
 * The client is injected so tests run it against a mock, with no network and no key.
 */

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
type FinalMessage = { content: Block[]; stop_reason?: string | null; usage?: Usage }
type StreamLike = { on(event: "text", listener: (delta: string) => void): unknown; finalMessage(): Promise<FinalMessage> }
type Params = {
  model: string
  max_tokens: number
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[]
  tools: ReturnType<typeof toolDefinitions>
  tool_choice?: { type: "auto" } | { type: "any" }
  messages: { role: "user" | "assistant"; content: unknown }[]
}
export type ModelClient = { messages: { stream(params: Params): StreamLike } }

export function createModelClient(): ModelClient | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  return new Anthropic({ apiKey }) as unknown as ModelClient
}

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "action"; label: string; href: string; undo: Created["undo"] }
  | { type: "confirm"; question: string; confirmLabel: string; pending: { tool: string; input: unknown } }
  | { type: "choices"; question: string; choices: string[] }
  | { type: "error"; message: string }

export type Tokens = { input: number; output: number }

// The stable part of the prompt comes first and is cached; the part that changes (today's date) follows it.
const SYSTEM = `Você é o assistente do Organizzou, um app de organização pessoal (tarefas, rotina, agenda, finanças, treinos, dieta, estudos, notas, metas e diário). Fale em português do Brasil, com respostas curtas e calmas, de uma ou duas frases. Sem emojis e sem enrolação.

Regras:
- Faça as coisas pelas ferramentas. Nunca diga que fez algo sem ter chamado a ferramenta e recebido ok. Se a ferramenta falhar, diga isso com honestidade.
- Depois de criar algo, confirme em uma frase no estilo "Gasto de R$ 45,00 registrado em Mercado." ou "Tarefa criada: Pagar aluguel · sexta".
- Use só o que a pessoa disse ou o que as ferramentas devolveram. Não invente dados, valores, datas ou nomes.
- Quando o pedido for ambíguo (duas tarefas parecidas, falta o valor, não está claro o dia), chame ask_user com 2 a 4 opções curtas em vez de adivinhar.
- Ações destrutivas (apagar) não rodam sozinhas: chame a ferramenta de apagar e a pessoa confirma com um botão.
- Você só conhece e só mexe nos dados do app desta pessoa, pelas ferramentas. Você não tem acesso a senhas, ao cofre nem a nenhum dado sensível; se pedirem, diga que não pode.
- Para perguntas sobre os dados (o que tenho hoje, quanto gastei), use as ferramentas de leitura e responda com os números de verdade.
- Datas e horas são do fuso de São Paulo. "sexta" é a próxima sexta-feira.
- Fora do escopo do app, diga em uma frase que só ajuda com a organização da pessoa.`

const systemBlocks = (now: Date) => [
  { type: "text" as const, text: SYSTEM, cache_control: { type: "ephemeral" as const } },
  {
    type: "text" as const,
    text: `Agora: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(now)} (America/Sao_Paulo). Hoje é ${new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(now)}.`,
  },
]

type RunOptions = {
  client: ModelClient
  model: string
  ctx: Ctx
  /** Earlier turns as plain text, oldest first (already truncated). */
  history: { role: "user" | "assistant"; text: string }[]
  userText: string
  emit: (event: ChatEvent) => void
}

const sumTokens = (total: Tokens, usage?: Usage) => {
  // Cached reads are billed at a fraction, but they are still tokens used: count everything the call consumed.
  total.input += (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0)
  total.output += usage?.output_tokens ?? 0
}

/** Runs one tool call the model asked for. Never throws. */
async function runTool(ctx: Ctx, tool: Tool, rawInput: unknown) {
  const parsed = tool.schema.safeParse(rawInput)
  if (!parsed.success) return { ok: false as const, message: `Dados inválidos para ${tool.name}: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}` }
  try {
    return await tool.run(ctx, parsed.data)
  } catch {
    return { ok: false as const, message: "Algo deu errado ao executar a ferramenta." }
  }
}

/** Executes an action the person confirmed with a button (re-validated here: the browser is not trusted). */
export async function runConfirmed(ctx: Ctx, pending: { tool: string; input: unknown }) {
  const tool = toolByName(pending.tool)
  if (!tool || !tool.destructive) return { ok: false as const, message: "Essa ação não precisa de confirmação." }
  const result = await runTool(ctx, tool, pending.input)
  if (result.ok) await ctx.supabase.from("audit_log").insert({ user_id: ctx.userId, actor: "assistant", action: `assistant.${tool.name}`, payload: { message: result.message }, confirmed_at: new Date().toISOString() })
  return result
}

/**
 * The chat turn: the model may call tools (creates run at once and are audited as the assistant; destructive ones wait for the
 * person; ambiguity turns into buttons). Returns the tokens used. Text is streamed through `emit` as it arrives.
 */
export async function runChat({ client, model, ctx, history, userText, emit }: RunOptions): Promise<{ tokens: Tokens; reply: string }> {
  const tokens: Tokens = { input: 0, output: 0 }
  const tools = toolDefinitions()
  const messages: Params["messages"] = [...history.map((m) => ({ role: m.role, content: m.text })), { role: "user", content: userText }]
  let reply = ""

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const stream = client.messages.stream({ model, max_tokens: MAX_OUTPUT_TOKENS, system: systemBlocks(ctx.now), tools, messages })
    stream.on("text", (delta) => {
      reply += delta
      emit({ type: "text", delta })
    })
    const message = await stream.finalMessage()
    sumTokens(tokens, message.usage)
    const calls = message.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use")
    if (message.stop_reason !== "tool_use" || calls.length === 0) break

    messages.push({ role: "assistant", content: message.content })
    const results: { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }[] = []
    for (const call of calls) {
      const tool = toolByName(call.name)
      if (!tool) {
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Ferramenta desconhecida.", is_error: true })
        continue
      }
      if (tool.name === "ask_user") {
        const parsed = tool.schema.safeParse(call.input)
        if (parsed.success) {
          const input = parsed.data as { question: string; choices: string[] }
          emit({ type: "choices", question: input.question, choices: input.choices })
          return { tokens, reply: reply || input.question }
        }
      }
      if (tool.destructive) {
        const parsed = tool.schema.safeParse(call.input)
        if (!parsed.success) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "Dados inválidos.", is_error: true })
          continue
        }
        const what = (parsed.data as { title_contains: string }).title_contains
        const question = tool.name === "delete_task" ? `Apagar a tarefa que tem “${what}” no nome?` : `Apagar o evento que tem “${what}” no nome?`
        emit({ type: "confirm", question, confirmLabel: "Apagar", pending: { tool: tool.name, input: parsed.data } })
        return { tokens, reply: reply || question }
      }
      const result = await runTool(ctx, tool, call.input)
      if (result.created) {
        emit({ type: "action", label: result.created.label, href: result.created.href, undo: result.created.undo })
        await auditCreated(ctx, "assistant", `assistant.${tool.name}`, result.created)
      } else if (result.ok && !tool.name.startsWith("list_") && tool.name !== "day_summary" && tool.name !== "finance_summary") {
        await ctx.supabase.from("audit_log").insert({ user_id: ctx.userId, actor: "assistant", action: `assistant.${tool.name}`, payload: { message: result.message } })
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify({ ok: result.ok, message: result.message, data: result.data }), is_error: !result.ok })
    }
    messages.push({ role: "user", content: results })
    reply += reply && !reply.endsWith("\n") ? "\n" : ""
  }
  return { tokens, reply: reply.trim() }
}

/**
 * Quick capture's model fallback: the rule parser was unsure, so the model reads the text and may call the create tools (and only
 * those). Returns what it created; nothing created means the caller keeps the text as an Inbox note.
 */
export async function runCapture({ client, model, ctx, text }: { client: ModelClient; model: string; ctx: Ctx; text: string }): Promise<{ created: Created[]; tokens: Tokens }> {
  const tokens: Tokens = { input: 0, output: 0 }
  const created: Created[] = []
  const creators = TOOLS.filter((t) => t.creates)
  const tools = toolDefinitions((t) => Boolean(t.creates))
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      ...systemBlocks(ctx.now),
      { type: "text", text: "Modo captura: o texto abaixo é uma anotação solta. Transforme em um ou mais registros chamando as ferramentas de criação (uma chamada por item). Se não der para ter certeza do que é, não chame nenhuma ferramenta. Não responda com texto." },
    ],
    tools,
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: text }],
  })
  const message = await stream.finalMessage()
  sumTokens(tokens, message.usage)
  for (const call of message.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use")) {
    const tool = creators.find((t) => t.name === call.name)
    if (!tool) continue
    const result = await runTool(ctx, tool, call.input)
    if (result.created) {
      created.push(result.created)
      await auditCreated(ctx, "assistant", `assistant.${tool.name}`, result.created, { via: "quick_capture" })
    }
  }
  return { created, tokens }
}
