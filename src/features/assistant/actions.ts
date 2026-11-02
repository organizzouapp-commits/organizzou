"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { classifyCapture, guessCategory, parseExpense } from "./rules"
import { getSession } from "@/lib/supabase/session"

export type CaptureResult = { ok: true; saved: "tarefa" | "gasto" | "nota"; href: string } | { ok: false; error: string }

const ERROR = "Não consegui salvar. Tente de novo."
const todaySp = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())

/**
 * Quick capture: one line of text becomes a real row. A task goes to the first list of the first board, "gastei 45 no mercado"
 * becomes a spending in the first account, and everything else is kept as a note (nothing is dropped and nothing is faked).
 * The routing is the same simple, rule-based reading the screen previews; the assistant proper is still "Em breve".
 */
export async function captureQuick(input: { text: string }): Promise<CaptureResult> {
  const parsed = z.object({ text: z.string().trim().min(1).max(2000) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Escreva alguma coisa." }
  const text = parsed.data.text
  const { supabase: client, userId } = await getSession()
  const supabase = client as unknown as SupabaseClient
  const destination = classifyCapture(text)

  if (destination === "tarefas") {
    const board = await supabase.from("boards").select("id").eq("archived", false).order("created_at").limit(1).maybeSingle()
    const boardId = (board.data as { id: string } | null)?.id
    if (boardId) {
      const list = await supabase.from("board_lists").select("id").eq("board_id", boardId).eq("is_done_list", false).order("position").limit(1).maybeSingle()
      const listId = (list.data as { id: string } | null)?.id
      if (listId) {
        const { error } = await supabase.from("tasks").insert({ user_id: userId, board_id: boardId, list_id: listId, title: text.slice(0, 200), position: Date.now() })
        if (!error) return { ok: true, saved: "tarefa", href: `/dashboard/tarefas/${boardId}` }
      }
    }
  }

  if (destination === "financas") {
    const expense = parseExpense(text)
    if (expense) {
      const [account, categories] = await Promise.all([
        supabase.from("finance_accounts").select("id").order("created_at").limit(1).maybeSingle(),
        supabase.from("finance_categories").select("id, name"),
      ])
      const accountId = (account.data as { id: string } | null)?.id
      if (accountId) {
        const wanted = guessCategory(expense.what)
        const category = ((categories.data ?? []) as { id: string; name: string }[]).find((c) => c.name === wanted)
        const { error } = await supabase.from("finance_transactions").insert({
          user_id: userId,
          account_id: accountId,
          category_id: category?.id ?? null,
          kind: "out",
          amount_cents: expense.cents,
          occurred_on: todaySp(),
          description: (expense.what.charAt(0).toUpperCase() + expense.what.slice(1)).slice(0, 200),
          source: "manual",
        })
        if (!error) return { ok: true, saved: "gasto", href: "/dashboard/financas" }
      }
    }
  }

  const { error } = await supabase.from("notes").insert({ user_id: userId, title: text.split("\n")[0].slice(0, 80), body: text })
  return error ? { ok: false, error: ERROR } : { ok: true, saved: "nota", href: "/dashboard/notas" }
}
