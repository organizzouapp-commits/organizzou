"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ModuleId } from "@/components/organizzou/modules"
import { createClient } from "@/lib/supabase/server"

export type SearchHit = { id: string; title: string; hint: string; module: ModuleId; href: string }

const LIMIT = 300

/**
 * What the global search (Ctrl/Cmd + K) can jump to: titles of the signed-in person's own rows, read with their session (RLS).
 * Only titles and a short hint leave the database; the palette filters them as the person types.
 */
export async function loadSearchIndex(): Promise<SearchHit[]> {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const titles = async (table: string, columns: string) => {
    const { data } = await supabase.from(table).select(columns).limit(LIMIT)
    return (data ?? []) as unknown as Record<string, string>[]
  }
  const [tasks, boards, notes, events, habits, subjects, goals] = await Promise.all([
    titles("tasks", "id, title, board_id"),
    titles("boards", "id, name"),
    titles("notes", "id, title"),
    titles("events", "id, title"),
    titles("habits", "id, name"),
    titles("subjects", "id, name"),
    titles("life_goals", "id, title"),
  ])
  const boardName = new Map(boards.map((b) => [b.id, b.name]))
  return [
    ...tasks.map((t) => ({ id: t.id, title: t.title, hint: boardName.get(t.board_id) ?? "Tarefa", module: "tarefas" as const, href: `/dashboard/tarefas/${t.board_id}` })),
    ...notes.filter((n) => n.title).map((n) => ({ id: n.id, title: n.title, hint: "Nota", module: "notas" as const, href: "/dashboard/notas" })),
    ...events.map((e) => ({ id: e.id, title: e.title, hint: "Evento", module: "agenda" as const, href: "/dashboard/agenda" })),
    ...habits.map((h) => ({ id: h.id, title: h.name, hint: "Hábito", module: "rotina" as const, href: "/dashboard/rotina" })),
    ...subjects.map((s) => ({ id: s.id, title: s.name, hint: "Estudos", module: "estudos" as const, href: "/dashboard/estudos" })),
    ...goals.map((g) => ({ id: g.id, title: g.title, hint: "Meta", module: "metas" as const, href: "/dashboard/metas" })),
  ]
}
