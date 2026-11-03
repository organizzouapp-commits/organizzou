import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { z } from "zod"

import { getUserPlan } from "@/lib/plan-server"
import { PLANS } from "@/lib/plans"
import { createClient } from "@/lib/supabase/server"
import { bypassAuth } from "@/lib/supabase/proxy"
import { type ChatEvent, createModelClient, runChat, runConfirmed } from "@/server/assistant/engine"
import { loadHistory, modelHistory, saveMessage } from "@/server/assistant/history"
import { assistantConfigured, assistantModel, checkQuota, recordUsage } from "@/server/assistant/usage"

/**
 * The app chat. GET: availability, today's usage and the stored conversation. POST: one turn, streamed as server-sent events
 * (text, action, confirm, choices, done, error). Runs on the signed-in person's own session; the key never reaches the browser.
 */

const body = z.object({
  message: z.string().trim().min(1).max(1000).optional(),
  confirm: z.object({ tool: z.string().max(60), input: z.unknown() }).optional(),
})

async function session() {
  if (bypassAuth) return null
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  return userId ? { supabase, userId } : null
}

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
const sse = (stream: ReadableStream) => new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform" } })

export async function GET() {
  const s = await session()
  if (!s) return json({ error: "unauthorized" }, 401)
  const plan = await getUserPlan(s.supabase, s.userId)
  const limit = PLANS[plan].limits.assistantMessagesPerDay ?? 200
  if (!assistantConfigured()) return json({ available: false, reason: "not_configured", limit, plan, history: [] })
  const quota = await checkQuota(s.supabase, s.userId, plan)
  if (!quota.ok && quota.reason === "unavailable") return json({ available: false, reason: "pending_update", limit, plan, history: [] })
  const history = await loadHistory(s.supabase)
  return json({ available: true, used: quota.used, limit, plan, history, limitReached: !quota.ok })
}

export async function POST(request: Request) {
  const s = await session()
  if (!s) return json({ error: "unauthorized" }, 401)
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success || (!parsed.data.message && !parsed.data.confirm)) return json({ error: "bad_request" }, 400)
  const client = createModelClient()
  if (!client) return json({ error: "unavailable", reason: "not_configured" }, 503)

  const now = new Date()
  const plan = await getUserPlan(s.supabase, s.userId)
  const preferred = (await cookies()).get("tasks_last_board")?.value ?? null
  const ctx = { supabase: s.supabase, userId: s.userId, now, preferredBoardId: preferred && /^[0-9a-f-]{36}$/i.test(preferred) ? preferred : null }
  const encoder = new TextEncoder()

  // A confirmed action (a button) runs without the model and does not count as a message.
  if (parsed.data.confirm) {
    const confirm = parsed.data.confirm
    return sse(
      new ReadableStream({
        async start(controller) {
          const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          const result = await runConfirmed(ctx, confirm)
          await saveMessage(s.supabase, s.userId, "assistant", { text: result.message })
          send({ type: "text", delta: result.message })
          send({ type: "done" })
          controller.close()
        },
      })
    )
  }

  const quota = await checkQuota(s.supabase, s.userId, plan, now)
  if (!quota.ok) return quota.reason === "limit" ? json({ error: "limit", used: quota.used, limit: quota.limit }, 429) : json({ error: "unavailable", reason: "pending_update" }, 503)

  const text = parsed.data.message!
  const history = modelHistory(await loadHistory(s.supabase))
  return sse(
    new ReadableStream({
      async start(controller) {
        const send = (event: ChatEvent | { type: "done"; used: number; limit: number }) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        const actions: { label: string; href: string }[] = []
        try {
          await saveMessage(s.supabase, s.userId, "user", { text })
          const { tokens, reply } = await runChat({
            client,
            model: assistantModel(),
            ctx,
            history,
            userText: text,
            emit: (event) => {
              if (event.type === "action") actions.push({ label: event.label, href: event.href })
              send(event)
            },
          })
          await recordUsage(s.supabase, tokens, now)
          await saveMessage(s.supabase, s.userId, "assistant", { text: reply || actions.map((a) => a.label).join("\n"), actions })
          send({ type: "done", used: quota.used + 1, limit: quota.limit })
        } catch {
          send({ type: "error", message: "Não consegui responder agora. Tente de novo em instantes." })
        } finally {
          controller.close()
        }
      },
    })
  )
}

export async function DELETE() {
  const s = await session()
  if (!s) return json({ error: "unauthorized" }, 401)
  const { error } = await s.supabase.from("assistant_messages").delete().gte("created_at", "1970-01-01")
  return error ? json({ error: "failed" }, 500) : json({ ok: true })
}
