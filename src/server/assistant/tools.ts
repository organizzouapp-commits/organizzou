import "server-only"

import { z } from "zod"

import { toDueIso } from "@/lib/dates"
import { dayOf, SP_TIMEZONE } from "@/lib/sp-time"

import { type Created, createFromItem, type Ctx } from "./execute"
import type { CaptureItem, CaptureType } from "./parse"

/**
 * The tools the model may call. Each one is a zod schema plus a function that runs on the PERSON'S OWN session (RLS), through the same
 * executors quick capture uses. There is no Vault tool, no raw SQL, no way to name another person's row, and nothing here reads the
 * `vault` schema (a test enforces the tool list and the imports). Anything destructive does not run: it asks the person first.
 */

export type ToolResult = { ok: boolean; message: string; data?: unknown; created?: Created }

export type Tool<S extends z.ZodType = z.ZodType> = {
  name: string
  description: string
  schema: S
  /** Creates records: the only tools quick capture's model fallback may use. */
  creates?: boolean
  /** Never runs by itself: the person confirms first. */
  destructive?: boolean
  run: (ctx: Ctx, input: z.infer<S>) => Promise<ToolResult>
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Dia no formato AAAA-MM-DD, fuso de São Paulo")
const time = z.string().regex(/^\d{2}:\d{2}$/).describe("Hora HH:mm, fuso de São Paulo")
const text = (max: number) => z.string().trim().min(1).max(max)

const tool = <S extends z.ZodType>(t: Tool<S>) => t as unknown as Tool

async function create(ctx: Ctx, type: CaptureType, fields: Omit<CaptureItem, "type" | "confidence" | "source">, source: string): Promise<ToolResult> {
  const outcome = await createFromItem(ctx, { type, confidence: 1, source, ...fields })
  return outcome.ok ? { ok: true, message: outcome.created.label, created: outcome.created } : { ok: false, message: outcome.reason }
}

const like = (query: string) => `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

async function openTasks(ctx: Ctx, query: string) {
  const { data } = await ctx.supabase.from("tasks").select("id, title, due_at, due_has_time, priority").is("completed_at", null).eq("archived", false).ilike("title", like(query)).order("due_at", { nullsFirst: false }).limit(5)
  return (data ?? []) as { id: string; title: string; due_at: string | null; due_has_time: boolean; priority: string }[]
}

const ambiguous = (kind: string, titles: string[]): ToolResult => ({ ok: false, message: `Achei mais de um ${kind}: ${titles.join("; ")}. Pergunte qual deles com ask_user.` })

export const TOOLS: Tool[] = [
  // ---- create -----------------------------------------------------------------------------------------------------------
  tool({
    name: "create_task",
    description: "Cria uma tarefa na lista de tarefas da pessoa.",
    creates: true,
    schema: z.object({ title: text(200), due_date: date.optional(), due_time: time.optional(), priority: z.enum(["low", "medium", "high"]).optional() }),
    run: (ctx, i) => create(ctx, "tarefa", { title: i.title, day: i.due_date, time: i.due_time, priority: i.priority }, i.title),
  }),
  tool({
    name: "create_transaction",
    description: "Registra um gasto (kind=out) ou uma receita (kind=in) na primeira conta de Finanças.",
    creates: true,
    schema: z.object({ kind: z.enum(["out", "in"]), amount_reais: z.number().positive().max(10_000_000), description: text(200), category: z.string().max(60).optional(), date: date.optional() }),
    run: (ctx, i) => create(ctx, i.kind === "in" ? "receita" : "gasto", { title: i.description, cents: Math.round(i.amount_reais * 100), category: i.category, day: i.date }, i.description),
  }),
  tool({
    name: "create_note",
    description: "Guarda uma nota.",
    creates: true,
    schema: z.object({ title: text(200), body: z.string().max(20000).optional() }),
    run: (ctx, i) => create(ctx, "nota", { title: i.title }, i.body ? `${i.title}\n${i.body}` : i.title),
  }),
  tool({
    name: "create_habit",
    description: "Cria um hábito diário novo na rotina.",
    creates: true,
    schema: z.object({ name: text(120) }),
    run: (ctx, i) => create(ctx, "habito", { title: i.name }, i.name),
  }),
  tool({
    name: "log_habit",
    description: "Marca como feito, hoje, um hábito que a pessoa já tem (procura pelo nome).",
    creates: true,
    schema: z.object({ habit_name: text(120) }),
    run: (ctx, i) => create(ctx, "habito", { title: i.habit_name, target: i.habit_name }, i.habit_name),
  }),
  tool({
    name: "create_event",
    description: "Cria um evento na agenda. Sem hora, é um evento de dia inteiro.",
    creates: true,
    schema: z.object({ title: text(200), date, time: time.optional() }),
    run: (ctx, i) => create(ctx, "evento", { title: i.title, day: i.date, time: i.time }, i.title),
  }),
  tool({
    name: "create_reminder",
    description: "Cria um lembrete para uma data e hora.",
    creates: true,
    schema: z.object({ title: text(200), date, time: time.optional() }),
    run: (ctx, i) => create(ctx, "lembrete", { title: i.title, day: i.date, time: i.time ?? "09:00" }, i.title),
  }),
  tool({
    name: "create_goal",
    description: "Cria uma meta de vida.",
    creates: true,
    schema: z.object({ title: text(160), deadline: date.optional() }),
    run: (ctx, i) => create(ctx, "meta", { title: i.title, day: i.deadline }, i.title),
  }),
  tool({
    name: "log_mood",
    description: "Registra o humor de hoje, de 1 (péssimo) a 5 (ótimo).",
    creates: true,
    schema: z.object({ mood: z.number().int().min(1).max(5) }),
    run: (ctx, i) => create(ctx, "humor", { title: `Humor ${i.mood} de 5`, amount: i.mood }, `humor ${i.mood}`),
  }),
  tool({
    name: "log_sleep",
    description: "Registra as horas de sono de hoje.",
    creates: true,
    schema: z.object({ hours: z.number().positive().max(24) }),
    run: (ctx, i) => create(ctx, "sono", { title: `${i.hours} h de sono`, amount: i.hours }, `dormi ${i.hours} horas`),
  }),
  tool({
    name: "log_water",
    description: "Registra água bebida hoje, em ml (um copo são 250 ml).",
    creates: true,
    schema: z.object({ ml: z.number().int().positive().max(5000) }),
    run: (ctx, i) => create(ctx, "agua", { title: `${i.ml} ml de água`, amount: i.ml }, `bebi ${i.ml} ml de água`),
  }),
  tool({
    name: "log_weight",
    description: "Registra o peso, em kg.",
    creates: true,
    schema: z.object({ kg: z.number().min(20).max(400), date: date.optional() }),
    run: (ctx, i) => create(ctx, "peso", { title: `${i.kg} kg`, amount: i.kg, day: i.date }, `${i.kg} kg`),
  }),
  tool({
    name: "log_workout",
    description: "Registra um treino feito hoje. plan_name é o nome de um plano de treino que a pessoa já tem.",
    creates: true,
    schema: z.object({ plan_name: z.string().max(80).optional(), minutes: z.number().int().min(1).max(1440).optional() }),
    run: (ctx, i) => create(ctx, "treino", { title: "Treino", target: i.plan_name, amount: i.minutes }, `treinei ${i.plan_name ?? ""}`),
  }),
  tool({
    name: "log_study",
    description: "Registra tempo de estudo hoje. subject é o nome de uma matéria que a pessoa já tem.",
    creates: true,
    schema: z.object({ subject: z.string().max(120).optional(), minutes: z.number().int().min(1).max(1440) }),
    run: (ctx, i) => create(ctx, "estudo", { title: `${i.minutes} min de estudo`, target: i.subject, amount: i.minutes }, `estudei ${i.minutes} min ${i.subject ?? ""}`),
  }),

  // ---- update / complete ------------------------------------------------------------------------------------------------
  tool({
    name: "complete_task",
    description: "Conclui uma tarefa aberta, procurando pelo título (parte dele basta).",
    schema: z.object({ title_contains: text(200) }),
    run: async (ctx, i) => {
      const found = await openTasks(ctx, i.title_contains)
      if (found.length === 0) return { ok: false, message: "Não achei uma tarefa aberta com esse nome." }
      if (found.length > 1) return ambiguous("tarefa", found.map((t) => t.title))
      const { error } = await ctx.supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", found[0].id)
      return error ? { ok: false, message: "Não consegui concluir a tarefa." } : { ok: true, message: `Tarefa concluída: ${found[0].title}.` }
    },
  }),
  tool({
    name: "update_task",
    description: "Muda o título, o prazo ou a prioridade de uma tarefa aberta, procurando pelo título.",
    schema: z.object({ title_contains: text(200), new_title: text(200).optional(), due_date: date.optional(), due_time: time.optional(), priority: z.enum(["none", "low", "medium", "high"]).optional() }),
    run: async (ctx, i) => {
      const found = await openTasks(ctx, i.title_contains)
      if (found.length === 0) return { ok: false, message: "Não achei uma tarefa aberta com esse nome." }
      if (found.length > 1) return ambiguous("tarefa", found.map((t) => t.title))
      const patch: Record<string, unknown> = {}
      if (i.new_title) patch.title = i.new_title
      if (i.priority) patch.priority = i.priority
      if (i.due_date) {
        patch.due_at = toDueIso(i.due_date, i.due_time ?? null, SP_TIMEZONE)
        patch.due_has_time = Boolean(i.due_time)
      }
      if (Object.keys(patch).length === 0) return { ok: false, message: "Nada para mudar." }
      const { error } = await ctx.supabase.from("tasks").update(patch).eq("id", found[0].id)
      return error ? { ok: false, message: "Não consegui atualizar a tarefa." } : { ok: true, message: `Tarefa atualizada: ${i.new_title ?? found[0].title}.` }
    },
  }),
  tool({
    name: "update_event",
    description: "Remarca um evento da agenda, procurando pelo título. Mantém a duração.",
    schema: z.object({ title_contains: text(200), date: date.optional(), time: time.optional() }),
    run: async (ctx, i) => {
      const { data } = await ctx.supabase.from("events").select("id, title, starts_at, ends_at, all_day").ilike("title", like(i.title_contains)).gte("starts_at", new Date(Date.now() - 86_400_000).toISOString()).order("starts_at").limit(5)
      const found = (data ?? []) as { id: string; title: string; starts_at: string; ends_at: string; all_day: boolean }[]
      if (found.length === 0) return { ok: false, message: "Não achei um evento com esse nome daqui para frente." }
      if (found.length > 1) return ambiguous("evento", found.map((e) => e.title))
      const ev = found[0]
      const duration = new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime()
      const day = i.date ?? dayOf(ev.starts_at, 0)
      const startsAt = toDueIso(day, i.time ?? (ev.all_day ? "00:00" : new Intl.DateTimeFormat("sv-SE", { timeZone: SP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(ev.starts_at))), SP_TIMEZONE)
      const { error } = await ctx.supabase.from("events").update({ starts_at: startsAt, ends_at: new Date(new Date(startsAt).getTime() + duration).toISOString() }).eq("id", ev.id)
      return error ? { ok: false, message: "Não consegui remarcar o evento." } : { ok: true, message: `Evento remarcado: ${ev.title}.` }
    },
  }),
  tool({
    name: "complete_reminder",
    description: "Marca um lembrete pendente como feito, procurando pelo título.",
    schema: z.object({ title_contains: text(200) }),
    run: async (ctx, i) => {
      const { data } = await ctx.supabase.from("reminders").select("id, title").eq("status", "pending").ilike("title", like(i.title_contains)).limit(5)
      const found = (data ?? []) as { id: string; title: string }[]
      if (found.length === 0) return { ok: false, message: "Não achei um lembrete pendente com esse nome." }
      if (found.length > 1) return ambiguous("lembrete", found.map((r) => r.title))
      const { error } = await ctx.supabase.from("reminders").update({ status: "done" }).eq("id", found[0].id)
      return error ? { ok: false, message: "Não consegui concluir o lembrete." } : { ok: true, message: `Lembrete concluído: ${found[0].title}.` }
    },
  }),
  tool({
    name: "pay_bill",
    description: "Marca uma conta fixa como paga neste mês, procurando pelo nome.",
    schema: z.object({ name_contains: text(80) }),
    run: async (ctx, i) => {
      const { data } = await ctx.supabase.from("finance_bills").select("id, name").eq("active", true).ilike("name", like(i.name_contains)).limit(5)
      const found = (data ?? []) as { id: string; name: string }[]
      if (found.length === 0) return { ok: false, message: "Não achei uma conta fixa com esse nome." }
      if (found.length > 1) return ambiguous("conta", found.map((b) => b.name))
      const { error } = await ctx.supabase.from("finance_bills").update({ last_paid_month: dayOf(ctx.now, 0).slice(0, 7) }).eq("id", found[0].id)
      return error ? { ok: false, message: "Não consegui marcar a conta como paga." } : { ok: true, message: `Conta paga neste mês: ${found[0].name}.` }
    },
  }),

  // ---- read only --------------------------------------------------------------------------------------------------------
  tool({
    name: "list_tasks",
    description: "Lista tarefas: abertas, de hoje, atrasadas ou concluídas. Somente leitura.",
    schema: z.object({ filter: z.enum(["open", "today", "overdue", "done"]), limit: z.number().int().min(1).max(20).optional() }),
    run: async (ctx, i) => {
      const today = dayOf(ctx.now, 0)
      const startOfToday = toDueIso(today, "00:00", SP_TIMEZONE)
      const endOfToday = toDueIso(today, "23:59", SP_TIMEZONE)
      let q = ctx.supabase.from("tasks").select("title, due_at, priority, completed_at").eq("archived", false)
      if (i.filter === "done") q = q.not("completed_at", "is", null).order("completed_at", { ascending: false })
      else {
        q = q.is("completed_at", null)
        if (i.filter === "today") q = q.gte("due_at", startOfToday).lte("due_at", endOfToday)
        if (i.filter === "overdue") q = q.lt("due_at", startOfToday)
        q = q.order("due_at", { nullsFirst: false })
      }
      const { data, error } = await q.limit(i.limit ?? 10)
      if (error) return { ok: false, message: "Não consegui ler as tarefas." }
      return { ok: true, message: `${(data ?? []).length} tarefa(s).`, data }
    },
  }),
  tool({
    name: "list_events",
    description: "Lista eventos da agenda entre duas datas (padrão: hoje e os próximos 7 dias). Somente leitura.",
    schema: z.object({ from: date.optional(), to: date.optional() }),
    run: async (ctx, i) => {
      const from = toDueIso(i.from ?? dayOf(ctx.now, 0), "00:00", SP_TIMEZONE)
      const to = toDueIso(i.to ?? dayOf(ctx.now, 7), "23:59", SP_TIMEZONE)
      const { data, error } = await ctx.supabase.from("events").select("title, starts_at, all_day, location").gte("starts_at", from).lte("starts_at", to).order("starts_at").limit(20)
      return error ? { ok: false, message: "Não consegui ler a agenda." } : { ok: true, message: `${(data ?? []).length} evento(s).`, data }
    },
  }),
  tool({
    name: "finance_summary",
    description: "Resumo de Finanças de um mês (padrão: o atual): entradas, saídas e as maiores categorias de gasto. Somente leitura.",
    schema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
    run: async (ctx, i) => {
      const month = i.month ?? dayOf(ctx.now, 0).slice(0, 7)
      const [rows, categories] = await Promise.all([
        ctx.supabase.from("finance_transactions").select("kind, amount_cents, category_id").gte("occurred_on", `${month}-01`).lte("occurred_on", `${month}-31`),
        ctx.supabase.from("finance_categories").select("id, name"),
      ])
      if (rows.error) return { ok: false, message: "Não consegui ler as finanças." }
      const names = new Map(((categories.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]))
      let income = 0
      let spent = 0
      const byCategory = new Map<string, number>()
      for (const r of (rows.data ?? []) as { kind: string; amount_cents: number; category_id: string | null }[]) {
        if (r.kind === "in") income += r.amount_cents
        else {
          spent += r.amount_cents
          const name = (r.category_id && names.get(r.category_id)) || "Sem categoria"
          byCategory.set(name, (byCategory.get(name) ?? 0) + r.amount_cents)
        }
      }
      const top = [...byCategory].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, cents]) => ({ category, reais: cents / 100 }))
      return { ok: true, message: `Resumo de ${month}.`, data: { month, income_reais: income / 100, spent_reais: spent / 100, balance_reais: (income - spent) / 100, top_categories: top } }
    },
  }),
  tool({
    name: "list_bills",
    description: "Lista as contas fixas ativas, com o dia de vencimento e se já foram pagas neste mês. Somente leitura.",
    schema: z.object({}),
    run: async (ctx) => {
      const { data, error } = await ctx.supabase.from("finance_bills").select("name, amount_cents, due_day, last_paid_month").eq("active", true).order("due_day")
      if (error) return { ok: false, message: "Não consegui ler as contas." }
      const month = dayOf(ctx.now, 0).slice(0, 7)
      return { ok: true, message: `${(data ?? []).length} conta(s).`, data: ((data ?? []) as { name: string; amount_cents: number; due_day: number; last_paid_month: string | null }[]).map((b) => ({ name: b.name, reais: b.amount_cents / 100, due_day: b.due_day, paid_this_month: b.last_paid_month === month })) }
    },
  }),
  tool({
    name: "day_summary",
    description: "Resumo de hoje: tarefas de hoje e atrasadas, eventos, hábitos feitos, água e gasto do dia. Somente leitura.",
    schema: z.object({}),
    run: async (ctx) => {
      const today = dayOf(ctx.now, 0)
      const start = toDueIso(today, "00:00", SP_TIMEZONE)
      const end = toDueIso(today, "23:59", SP_TIMEZONE)
      const [due, overdue, events, habits, logs, water, spent] = await Promise.all([
        ctx.supabase.from("tasks").select("title").is("completed_at", null).eq("archived", false).gte("due_at", start).lte("due_at", end).limit(10),
        ctx.supabase.from("tasks").select("title", { count: "exact", head: true }).is("completed_at", null).eq("archived", false).lt("due_at", start),
        ctx.supabase.from("events").select("title, starts_at, all_day").gte("starts_at", start).lte("starts_at", end).order("starts_at").limit(10),
        ctx.supabase.from("habits").select("id", { count: "exact", head: true }).eq("paused", false),
        ctx.supabase.from("habit_logs").select("habit_id", { count: "exact", head: true }).eq("log_date", today),
        ctx.supabase.from("water_logs").select("ml").eq("log_date", today),
        ctx.supabase.from("finance_transactions").select("amount_cents").eq("kind", "out").eq("occurred_on", today),
      ])
      const sum = (rows: { ml?: number; amount_cents?: number }[] | null, key: "ml" | "amount_cents") => (rows ?? []).reduce((total, r) => total + (r[key] ?? 0), 0)
      return {
        ok: true,
        message: "Resumo de hoje.",
        data: {
          tasks_due_today: due.data ?? [],
          overdue_tasks: overdue.count ?? 0,
          events_today: events.data ?? [],
          habits_done: logs.count ?? 0,
          habits_total: habits.count ?? 0,
          water_ml: sum(water.data, "ml"),
          spent_today_reais: sum(spent.data, "amount_cents") / 100,
        },
      }
    },
  }),

  // ---- asking and destructive -------------------------------------------------------------------------------------------
  tool({
    name: "ask_user",
    description: "Pergunta algo à pessoa quando o pedido é ambíguo (por exemplo, duas tarefas com nome parecido). Dê 2 a 4 opções curtas; elas viram botões.",
    schema: z.object({ question: text(300), choices: z.array(text(60)).min(2).max(4) }),
    run: async (_ctx, i) => ({ ok: true, message: i.question }),
  }),
  tool({
    name: "delete_task",
    description: "Apaga uma tarefa pelo título. NUNCA executa sozinha: a pessoa confirma antes.",
    destructive: true,
    schema: z.object({ title_contains: text(200) }),
    run: async (ctx, i) => {
      const found = await openTasks(ctx, i.title_contains)
      if (found.length === 0) return { ok: false, message: "Não achei uma tarefa aberta com esse nome." }
      if (found.length > 1) return ambiguous("tarefa", found.map((t) => t.title))
      const { error } = await ctx.supabase.from("tasks").delete().eq("id", found[0].id)
      return error ? { ok: false, message: "Não consegui apagar a tarefa." } : { ok: true, message: `Tarefa apagada: ${found[0].title}.` }
    },
  }),
  tool({
    name: "delete_event",
    description: "Apaga um evento futuro pelo título. NUNCA executa sozinha: a pessoa confirma antes.",
    destructive: true,
    schema: z.object({ title_contains: text(200) }),
    run: async (ctx, i) => {
      const { data } = await ctx.supabase.from("events").select("id, title").ilike("title", like(i.title_contains)).gte("starts_at", new Date(Date.now() - 86_400_000).toISOString()).limit(5)
      const found = (data ?? []) as { id: string; title: string }[]
      if (found.length === 0) return { ok: false, message: "Não achei um evento com esse nome daqui para frente." }
      if (found.length > 1) return ambiguous("evento", found.map((e) => e.title))
      const { error } = await ctx.supabase.from("events").delete().eq("id", found[0].id)
      return error ? { ok: false, message: "Não consegui apagar o evento." } : { ok: true, message: `Evento apagado: ${found[0].title}.` }
    },
  }),
]

export const toolByName = (name: string) => TOOLS.find((t) => t.name === name)

/** The JSON schema the model sees for a tool (zod is the single source of truth, so validation and the schema cannot drift). */
export function toolDefinitions(only?: (tool: Tool) => boolean) {
  return TOOLS.filter((t) => (only ? only(t) : true)).map((t) => {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>
    void _ignored
    return { name: t.name, description: t.description, input_schema: schema as { type: "object"; properties?: Record<string, unknown>; required?: string[] } }
  })
}

