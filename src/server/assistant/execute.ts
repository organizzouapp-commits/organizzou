import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { toDueIso } from "@/lib/dates"
import { at, dayOf, SP_TIMEZONE } from "@/lib/sp-time"

import { type CaptureItem, type CaptureType, TYPE_LABELS, whenLabel } from "./parse"

/**
 * Creates the real rows for a reading of the user's text. Used by quick capture and by the chat tools, so both behave the same.
 * It runs on the signed-in person's own client (RLS decides what is allowed): there is no service role anywhere in here, and the
 * only tables touched are the person's own module tables (never anything Vault-related).
 */

export type Ctx = { supabase: SupabaseClient; userId: string; now: Date; preferredBoardId?: string | null }

/** What to do to take a creation back. */
export type UndoStep = { table: string; id: string; restore?: Record<string, unknown> }

export type Created = {
  type: CaptureType
  table: string
  id: string
  /** "Tarefa criada: Pagar aluguel · sexta" */
  label: string
  href: string
  undo: UndoStep[]
}

export type Outcome = { ok: true; created: Created } | { ok: false; reason: string }

const fail = (reason: string): Outcome => ({ ok: false, reason })
const uuid = () => crypto.randomUUID()
const NAME: Record<CaptureType, string> = { tarefa: "Tarefa criada", gasto: "Gasto registrado", receita: "Receita registrada", nota: "Nota criada", habito: "Hábito", evento: "Evento criado", lembrete: "Lembrete criado", meta: "Meta criada", humor: "Humor registrado", agua: "Água registrada", peso: "Peso registrado", sono: "Sono registrado", treino: "Treino registrado", estudo: "Estudo registrado" }
const withWhen = (label: string, title: string, item: CaptureItem, now: Date) => {
  const when = whenLabel(item, now)
  return `${label}: ${title}${when ? ` · ${when}` : ""}`
}
const norm = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
/** True when the two names share a meaningful word (or one contains the other). */
const similar = (a: string, b: string) => {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x.includes(y) || y.includes(x)) return true
  const words = (t: string) => t.split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const wb = new Set(words(y))
  return words(x).some((w) => wb.has(w))
}

async function insert(ctx: Ctx, table: string, row: Record<string, unknown>): Promise<string | null> {
  const { error } = await ctx.supabase.from(table).insert({ ...row, user_id: ctx.userId })
  return error ? error.message : null
}

const ok = (created: Created): Outcome => ({ ok: true, created })

/** Creates the one thing `item` describes. Returns a reason (never throws) when it cannot, so the caller can keep the text as a note. */
export async function createFromItem(ctx: Ctx, item: CaptureItem): Promise<Outcome> {
  const { supabase, now } = ctx
  const today = dayOf(now, 0)
  const id = uuid()

  switch (item.type) {
    case "tarefa": {
      let boardId = ctx.preferredBoardId ?? null
      if (boardId) {
        const own = await supabase.from("boards").select("id").eq("id", boardId).eq("archived", false).maybeSingle()
        if (!own.data) boardId = null
      }
      if (!boardId) {
        const first = await supabase.from("boards").select("id").eq("archived", false).order("created_at").limit(1).maybeSingle()
        boardId = (first.data as { id: string } | null)?.id ?? null
      }
      if (!boardId) return fail("Você ainda não tem uma lista de tarefas.")
      const list = await supabase.from("board_lists").select("id").eq("board_id", boardId).eq("is_done_list", false).order("position").limit(1).maybeSingle()
      const listId = (list.data as { id: string } | null)?.id
      if (!listId) return fail("A lista de tarefas não tem uma coluna aberta.")
      const error = await insert(ctx, "tasks", {
        id,
        board_id: boardId,
        list_id: listId,
        title: item.title.slice(0, 200),
        priority: item.priority ?? "none",
        due_at: item.day ? toDueIso(item.day, item.time ?? null, SP_TIMEZONE) : null,
        due_has_time: Boolean(item.day && item.time),
        position: Date.now(),
      })
      if (error) return fail(error)
      return ok({ type: "tarefa", table: "tasks", id, label: withWhen(NAME.tarefa, item.title, item, now), href: `/dashboard/tarefas/${boardId}`, undo: [{ table: "tasks", id }] })
    }

    case "gasto":
    case "receita": {
      if (!item.cents) return fail("Faltou o valor.")
      const account = await supabase.from("finance_accounts").select("id").order("created_at").limit(1).maybeSingle()
      const accountId = (account.data as { id: string } | null)?.id
      if (!accountId) return fail("Você ainda não tem uma conta em Finanças.")
      let categoryId: string | null = null
      if (item.category) {
        const categories = await supabase.from("finance_categories").select("id, name")
        categoryId = ((categories.data ?? []) as { id: string; name: string }[]).find((c) => norm(c.name) === norm(item.category!))?.id ?? null
      }
      const error = await insert(ctx, "finance_transactions", {
        id,
        account_id: accountId,
        category_id: categoryId,
        kind: item.type === "receita" ? "in" : "out",
        amount_cents: item.cents,
        occurred_on: item.day ?? today,
        description: item.title.slice(0, 200),
        source: "manual",
      })
      if (error) return fail(error)
      const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.cents / 100).replace(/ /g, " ")
      return ok({ type: item.type, table: "finance_transactions", id, label: `${item.type === "receita" ? "Receita" : "Gasto"} de ${money} registrado${item.category && item.type === "gasto" ? ` em ${item.category}` : ""}`, href: "/dashboard/financas", undo: [{ table: "finance_transactions", id }] })
    }

    case "nota": {
      const error = await insert(ctx, "notes", { id, folder_id: null, title: item.title.slice(0, 200), body: item.source, pinned: false, tags: [] })
      if (error) return fail(error)
      return ok({ type: "nota", table: "notes", id, label: `${NAME.nota}: ${item.title}`, href: "/dashboard/notas", undo: [{ table: "notes", id }] })
    }

    case "habito": {
      const habits = await supabase.from("habits").select("id, name")
      const rows = (habits.data ?? []) as { id: string; name: string }[]
      if (item.target) {
        const match = rows.find((h) => similar(item.target!, h.name))
        if (!match) return fail("Não achei esse hábito na sua rotina.")
        const existing = await supabase.from("habit_logs").select("id, qty").eq("habit_id", match.id).eq("log_date", today).maybeSingle()
        const prior = existing.data as { id: string; qty: number } | null
        if (prior) {
          const { error } = await supabase.from("habit_logs").update({ qty: prior.qty + 1 }).eq("id", prior.id)
          if (error) return fail(error.message)
          return ok({ type: "habito", table: "habit_logs", id: prior.id, label: `Hábito marcado: ${match.name}`, href: "/dashboard/rotina", undo: [{ table: "habit_logs", id: prior.id, restore: { qty: prior.qty } }] })
        }
        const error = await insert(ctx, "habit_logs", { id, habit_id: match.id, log_date: today, qty: 1 })
        if (error) return fail(error)
        return ok({ type: "habito", table: "habit_logs", id, label: `Hábito marcado: ${match.name}`, href: "/dashboard/rotina", undo: [{ table: "habit_logs", id }] })
      }
      const error = await insert(ctx, "habits", { id, name: item.title.slice(0, 120), type: "fixed", target_qty: null, unit: null, weekdays: [0, 1, 2, 3, 4, 5, 6], deadline: null, paused: false })
      if (error) return fail(error)
      return ok({ type: "habito", table: "habits", id, label: `Hábito criado: ${item.title}`, href: "/dashboard/rotina", undo: [{ table: "habits", id }] })
    }

    case "evento": {
      const day = item.day ?? today
      const allDay = !item.time
      const startsAt = allDay ? at(`${day}T12:00:00Z`, 0, "00:00") : toDueIso(day, item.time!, SP_TIMEZONE)
      const endsAt = allDay ? at(`${day}T12:00:00Z`, 1, "00:00") : new Date(new Date(startsAt).getTime() + 3_600_000).toISOString()
      const error = await insert(ctx, "events", { id, title: item.title.slice(0, 200), starts_at: startsAt, ends_at: endsAt, all_day: allDay, description: null, location: null, category: null, swatch: "neutro", rrule: null, reminder_offsets: [] })
      if (error) return fail(error)
      return ok({ type: "evento", table: "events", id, label: withWhen(NAME.evento, item.title, { ...item, day }, now), href: "/dashboard/agenda", undo: [{ table: "events", id }] })
    }

    case "lembrete": {
      const day = item.day ?? today
      const error = await insert(ctx, "reminders", { id, title: item.title.slice(0, 200), remind_at: toDueIso(day, item.time ?? "09:00", SP_TIMEZONE), channels: ["push"], status: "pending", note_id: null })
      if (error) return fail(error)
      return ok({ type: "lembrete", table: "reminders", id, label: withWhen(NAME.lembrete, item.title, { ...item, day, time: item.time ?? "09:00" }, now), href: "/dashboard/notas", undo: [{ table: "reminders", id }] })
    }

    case "meta": {
      const error = await insert(ctx, "life_goals", { id, title: item.title.slice(0, 160), description: null, deadline: item.day ?? null, status: "active" })
      if (error) return fail(error)
      return ok({ type: "meta", table: "life_goals", id, label: `${NAME.meta}: ${item.title}`, href: "/dashboard/metas", undo: [{ table: "life_goals", id }] })
    }

    case "humor":
    case "sono": {
      const existing = await supabase.from("journal_entries").select("id, mood, sleep_hours").eq("entry_date", today).maybeSingle()
      const prior = existing.data as { id: string; mood: number; sleep_hours: number | null } | null
      const patch = item.type === "humor" ? { mood: item.amount } : { sleep_hours: item.amount }
      if (prior) {
        const { error } = await supabase.from("journal_entries").update(patch).eq("id", prior.id)
        if (error) return fail(error.message)
        return ok({ type: item.type, table: "journal_entries", id: prior.id, label: item.type === "humor" ? `Humor registrado: ${item.amount} de 5` : `Sono registrado: ${item.amount} h`, href: "/dashboard/diario", undo: [{ table: "journal_entries", id: prior.id, restore: item.type === "humor" ? { mood: prior.mood } : { sleep_hours: prior.sleep_hours } }] })
      }
      // No check-in yet today: a sleep note starts one at the neutral mood (3), and says so, rather than inventing a mood.
      const error = await insert(ctx, "journal_entries", { id, entry_date: today, mood: item.type === "humor" ? item.amount : 3, text: "", sleep_hours: item.type === "sono" ? item.amount : null })
      if (error) return fail(error)
      return ok({ type: item.type, table: "journal_entries", id, label: item.type === "humor" ? `Humor registrado: ${item.amount} de 5` : `Sono registrado: ${item.amount} h (humor ficou em 3, ajuste no Diário)`, href: "/dashboard/diario", undo: [{ table: "journal_entries", id }] })
    }

    case "agua": {
      const error = await insert(ctx, "water_logs", { id, log_date: today, ml: item.amount })
      if (error) return fail(error)
      return ok({ type: "agua", table: "water_logs", id, label: `Água registrada: ${item.amount} ml`, href: "/dashboard/dieta", undo: [{ table: "water_logs", id }] })
    }

    case "peso": {
      const day = item.day ?? today
      const existing = await supabase.from("weight_logs").select("id, weight_kg").eq("log_date", day).maybeSingle()
      const prior = existing.data as { id: string; weight_kg: number } | null
      if (prior) {
        const { error } = await supabase.from("weight_logs").update({ weight_kg: item.amount }).eq("id", prior.id)
        if (error) return fail(error.message)
        return ok({ type: "peso", table: "weight_logs", id: prior.id, label: `Peso atualizado: ${String(item.amount).replace(".", ",")} kg`, href: "/dashboard/dieta", undo: [{ table: "weight_logs", id: prior.id, restore: { weight_kg: prior.weight_kg } }] })
      }
      const error = await insert(ctx, "weight_logs", { id, log_date: day, weight_kg: item.amount })
      if (error) return fail(error)
      return ok({ type: "peso", table: "weight_logs", id, label: `Peso registrado: ${String(item.amount).replace(".", ",")} kg`, href: "/dashboard/dieta", undo: [{ table: "weight_logs", id }] })
    }

    case "treino": {
      const plans = await supabase.from("workout_plans").select("id, name").order("created_at")
      const rows = (plans.data ?? []) as { id: string; name: string }[]
      if (rows.length === 0) return fail("Você ainda não tem um plano de treino.")
      const plan = (item.target ? rows.find((p) => similar(item.target!, p.name)) : undefined) ?? (rows.length === 1 ? rows[0] : undefined)
      if (!plan) return fail("Não sei de qual plano de treino é esse.")
      const error = await insert(ctx, "workout_sessions", { id, plan_id: plan.id, performed_on: today, duration_min: item.amount ?? null, completed: true })
      if (error) return fail(error)
      return ok({ type: "treino", table: "workout_sessions", id, label: `Treino registrado: ${plan.name}${item.amount ? ` · ${item.amount} min` : ""}`, href: "/dashboard/treinos", undo: [{ table: "workout_sessions", id }] })
    }

    case "estudo": {
      const subjects = await supabase.from("subjects").select("id, name").order("created_at")
      const rows = (subjects.data ?? []) as { id: string; name: string }[]
      if (rows.length === 0) return fail("Você ainda não tem matérias em Estudos.")
      const subject = (item.target ? rows.find((s) => similar(item.target!, s.name)) : undefined) ?? (rows.length === 1 ? rows[0] : undefined)
      if (!subject) return fail("Não sei de qual matéria é esse estudo.")
      const error = await insert(ctx, "study_sessions", { id, subject_id: subject.id, studied_on: today, minutes: item.amount, mode: "free" })
      if (error) return fail(error)
      return ok({ type: "estudo", table: "study_sessions", id, label: `Estudo registrado: ${item.amount} min de ${subject.name}`, href: "/dashboard/estudos", undo: [{ table: "study_sessions", id }] })
    }
  }
}

/** The Inbox folder of notes: found, or made the first time something unsure is saved. */
async function inboxFolderId(ctx: Ctx): Promise<string | null> {
  const found = await ctx.supabase.from("note_folders").select("id").eq("name", "Inbox").limit(1).maybeSingle()
  const existing = (found.data as { id: string } | null)?.id
  if (existing) return existing
  const id = uuid()
  const error = await insert(ctx, "note_folders", { id, name: "Inbox" })
  return error ? null : id
}

/** Never lose the text: whatever could not be understood or created is kept as a note in the Inbox folder. */
export async function saveToInbox(ctx: Ctx, text: string, reason?: string): Promise<Outcome> {
  const id = uuid()
  const folderId = await inboxFolderId(ctx)
  const body = text.trim()
  const title = (body.split("\n")[0] || "Captura").slice(0, 80)
  const error = await insert(ctx, "notes", { id, folder_id: folderId, title, body, pinned: false, tags: [] })
  if (error) return fail(error)
  return ok({ type: "nota", table: "notes", id, label: `Salvei como nota: ${title}${reason ? ` (${reason})` : ""}`, href: "/dashboard/notas", undo: [{ table: "notes", id }] })
}

/** Takes creations back (the 8-second "Desfazer"). RLS keeps it to the person's own rows. */
export async function undoSteps(ctx: Ctx, steps: UndoStep[]): Promise<{ ok: boolean }> {
  let allOk = true
  for (const step of steps) {
    const query = step.restore ? ctx.supabase.from(step.table).update(step.restore).eq("id", step.id) : ctx.supabase.from(step.table).delete().eq("id", step.id)
    const { error } = await query
    if (error) allOk = false
  }
  return { ok: allOk }
}

/** Audit trail: who created what. Quick capture writes its own actor; if the database does not know it yet, it falls back to "app". */
export async function auditCreated(ctx: Ctx, actor: "app_quick_capture" | "assistant", action: string, created: Created, extra: Record<string, unknown> = {}) {
  const row = { user_id: ctx.userId, action, entity_type: created.table, entity_id: created.id, payload: { type: created.type, label: created.label, ...extra } }
  const first = await ctx.supabase.from("audit_log").insert({ ...row, actor })
  if (first.error && actor === "app_quick_capture") await ctx.supabase.from("audit_log").insert({ ...row, actor: "app", payload: { ...row.payload, actor: "app_quick_capture" } })
}

export const typeName = (type: CaptureType) => TYPE_LABELS[type]
