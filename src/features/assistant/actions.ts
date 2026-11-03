"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { z } from "zod"

import { getUserPlan } from "@/lib/plan-server"
import { getSession } from "@/lib/supabase/session"
import { createModelClient, runCapture } from "@/server/assistant/engine"
import { auditCreated, type Created, createFromItem, type Ctx, saveToInbox, undoSteps } from "@/server/assistant/execute"
import { CAPTURE_TYPES, type CaptureItem, isConfident, parseCapture, readAs } from "@/server/assistant/parse"
import { assistantModel, checkQuota, recordUsage } from "@/server/assistant/usage"

/**
 * Quick capture on the server. Whatever is typed ALWAYS ends up saved: understood text becomes the matching record, and anything
 * unsure (or that cannot be created, for example a spending with no account yet) is kept as a note in the "Inbox" folder, with a way to
 * convert it. The rule parser runs first (free and offline); the model is only asked about the unsure part, when a key is set and the
 * person is under their daily limit. Every record created is written to the audit log (actor: app_quick_capture).
 */

export type CaptureEntry = { label: string; href: string; undo: Created["undo"]; type: string; inbox?: boolean; noteId?: string }
export type CaptureResult = { ok: true; entries: CaptureEntry[]; usedModel: boolean } | { ok: false; error: string }

const ERROR = "Não consegui salvar. Seu texto continua aqui, tente de novo."

const itemSchema = z.object({
  type: z.enum(CAPTURE_TYPES),
  confidence: z.number().min(0).max(1),
  source: z.string().max(2000),
  title: z.string().max(300),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  cents: z.number().int().positive().max(9_000_000_000_000).optional(),
  category: z.string().max(60).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  amount: z.number().max(1_000_000).optional(),
  target: z.string().max(300).optional(),
})

const inputSchema = z.object({ text: z.string().trim().min(1).max(2000), items: z.array(itemSchema).max(12).optional() })

async function context(): Promise<Ctx & { plan: Awaited<ReturnType<typeof getUserPlan>> }> {
  const { supabase, userId } = await getSession()
  const client = supabase as unknown as SupabaseClient
  const preferred = (await cookies()).get("tasks_last_board")?.value ?? null
  return { supabase: client, userId, now: new Date(), preferredBoardId: preferred && /^[0-9a-f-]{36}$/i.test(preferred) ? preferred : null, plan: await getUserPlan(client, userId) }
}

const entryOf = (created: Created, extra: Partial<CaptureEntry> = {}): CaptureEntry => ({ label: created.label, href: created.href, undo: created.undo, type: created.type, ...extra })

export async function captureQuick(input: { text: string; items?: CaptureItem[] }): Promise<CaptureResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Escreva alguma coisa." }
  const { text } = parsed.data
  try {
    const ctx = await context()
    const items = (parsed.data.items?.length ? (parsed.data.items as CaptureItem[]) : parseCapture(text, ctx.now))
    const entries: CaptureEntry[] = []
    const unsure: CaptureItem[] = []

    for (const item of items) {
      if (!isConfident(item)) {
        unsure.push(item)
        continue
      }
      const outcome = await createFromItem(ctx, item)
      if (outcome.ok) {
        await auditCreated(ctx, "app_quick_capture", "quick_capture.create", outcome.created, { engine: "rules" })
        entries.push(entryOf(outcome.created))
      } else {
        // It could not be created as that type (no account, no matching habit...): the words are kept as an Inbox note, never dropped.
        unsure.push({ ...item, confidence: 0 })
      }
    }

    let usedModel = false
    if (unsure.length > 0) {
      const unsureText = unsure.map((u) => u.source).join("\n")
      const client = createModelClient()
      if (client) {
        const quota = await checkQuota(ctx.supabase, ctx.userId, ctx.plan, ctx.now)
        if (quota.ok) {
          try {
            const { created, tokens } = await runCapture({ client, model: assistantModel(), ctx, text: unsureText })
            await recordUsage(ctx.supabase, tokens, ctx.now)
            usedModel = true
            for (const c of created) entries.push(entryOf(c))
            if (created.length > 0) unsure.length = 0
          } catch {
            // The model is down or errored: fall through to the Inbox note.
          }
        }
      }
      for (const item of unsure) {
        const saved = await saveToInbox(ctx, item.source)
        if (!saved.ok) {
          if (entries.length === 0) return { ok: false, error: ERROR }
          continue
        }
        await auditCreated(ctx, "app_quick_capture", "quick_capture.inbox", saved.created, { engine: "inbox" })
        entries.push(entryOf(saved.created, { inbox: true, noteId: saved.created.id }))
      }
    }
    if (entries.length === 0) return { ok: false, error: ERROR }
    return { ok: true, entries, usedModel }
  } catch {
    return { ok: false, error: ERROR }
  }
}

const UNDO_TABLES = ["tasks", "finance_transactions", "notes", "habits", "habit_logs", "events", "reminders", "life_goals", "journal_entries", "water_logs", "weight_logs", "workout_sessions", "study_sessions"] as const
const undoSchema = z.array(z.object({ table: z.enum(UNDO_TABLES), id: z.uuid(), restore: z.record(z.string(), z.unknown()).optional() })).min(1).max(24)

/** The 8-second "Desfazer": takes back what a capture just created (only tables a capture can write, only the person's own rows). */
export async function undoCapture(steps: Created["undo"]): Promise<{ ok: boolean }> {
  const parsed = undoSchema.safeParse(steps)
  if (!parsed.success) return { ok: false }
  const { supabase, userId } = await getSession()
  return undoSteps({ supabase: supabase as unknown as SupabaseClient, userId, now: new Date() }, parsed.data)
}

/** "Salvei como nota. Mudar para…": re-reads the Inbox note as the chosen type and, if that works, replaces the note with the record. */
export async function convertCapture(input: { noteId: string; type: (typeof CAPTURE_TYPES)[number] }): Promise<{ ok: true; entry: CaptureEntry } | { ok: false; error: string }> {
  const parsed = z.object({ noteId: z.uuid(), type: z.enum(CAPTURE_TYPES) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Não entendi o pedido." }
  const ctx = await context()
  const note = await ctx.supabase.from("notes").select("id, body").eq("id", parsed.data.noteId).maybeSingle()
  const body = (note.data as { body: string } | null)?.body
  if (!body) return { ok: false, error: "Não achei essa nota." }
  const item = readAs(parsed.data.type, body, ctx.now)
  if (!item) return { ok: false, error: "Não deu para ler esse texto assim. A nota continua no Inbox." }
  const outcome = await createFromItem(ctx, item)
  if (!outcome.ok) return { ok: false, error: `${outcome.reason} A nota continua no Inbox.` }
  await ctx.supabase.from("notes").delete().eq("id", parsed.data.noteId)
  await auditCreated(ctx, "app_quick_capture", "quick_capture.convert", outcome.created, { from: "inbox" })
  return { ok: true, entry: entryOf(outcome.created) }
}
