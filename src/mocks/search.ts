import type { ModuleId } from "@/components/organizzou/modules"

import { buildMockNotes } from "./notes"
import { mockHabits } from "./habits"
import { mockSubjects } from "./studies"
import { getMockBoardsStore } from "./tasks-api"
import { buildMockGoals } from "./goals"
import { buildMockEvents } from "./calendar"

export type SearchHit = { id: string; title: string; hint: string; module: ModuleId; href: string }

/** Everything the global search (Ctrl/Cmd + K) can jump to. Later phases query each module instead. */
export function buildSearchIndex(nowIso: string): SearchHit[] {
  const hits: SearchHit[] = []
  for (const board of getMockBoardsStore(nowIso).boards) {
    for (const task of board.tasks) {
      hits.push({ id: task.id, title: task.title, hint: board.board.name, module: "tarefas", href: `/tarefas/${board.board.id}` })
    }
  }
  for (const note of buildMockNotes(nowIso)) hits.push({ id: note.id, title: note.title, hint: "Nota", module: "notas", href: "/notas" })
  for (const event of buildMockEvents(nowIso)) hits.push({ id: event.id, title: event.title, hint: "Evento", module: "agenda", href: "/agenda" })
  for (const habit of mockHabits) hits.push({ id: habit.id, title: habit.name, hint: "Hábito", module: "rotina", href: "/rotina" })
  for (const subject of mockSubjects) hits.push({ id: subject.id, title: subject.name, hint: "Estudos", module: "estudos", href: "/estudos" })
  for (const goal of buildMockGoals(nowIso)) hits.push({ id: goal.id, title: goal.title, hint: "Meta", module: "metas", href: "/metas" })
  return hits
}
