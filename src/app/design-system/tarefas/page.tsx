import { Suspense } from "react"
import { connection } from "next/server"

import { BoardClient } from "@/components/tasks/board-client"
import type { ViewMode } from "@/components/tasks/board-toolbar"
import { ThemeToggle } from "@/components/organizzou/ThemeToggle"
import { Logo } from "@/components/organizzou/Logo"
import type { BoardData, ListRow, TagRow, TaskView } from "@/features/tasks/types"

// Preview of the Tasks module with fictional data. Nothing here touches the database.
const USER = "00000000-0000-4000-8000-000000000000"
const BOARD = "00000000-0000-4000-8000-0000000000b1"
const stamp = { created_at: "2026-03-01T12:00:00.000Z", updated_at: "2026-03-01T12:00:00.000Z" }

const lists: ListRow[] = [
  { id: "l1", user_id: USER, board_id: BOARD, name: "A fazer", position: 1000, is_done_list: false, ...stamp },
  { id: "l2", user_id: USER, board_id: BOARD, name: "Em andamento", position: 2000, is_done_list: false, ...stamp },
  { id: "l3", user_id: USER, board_id: BOARD, name: "Concluído", position: 3000, is_done_list: true, ...stamp },
]

const tags: TagRow[] = [
  { id: "g1", user_id: USER, name: "Trabalho", swatch: "tinta-verso", ...stamp },
  { id: "g2", user_id: USER, name: "Pessoal", swatch: "lima-verso", ...stamp },
  { id: "g3", user_id: USER, name: "Urgente", swatch: "lima", ...stamp },
]

function at(days: number, hour: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(hour, 0, 0, 0)
  return date.toISOString()
}

function task(id: string, listId: string, position: number, extra: Partial<TaskView>): TaskView {
  return {
    id,
    user_id: USER,
    board_id: BOARD,
    list_id: listId,
    title: "Tarefa",
    description: null,
    priority: "none",
    due_at: null,
    due_has_time: false,
    category: null,
    swatch: "neutro",
    position,
    completed_at: null,
    archived: false,
    tagIds: [],
    checklistTotal: 0,
    checklistDone: 0,
    commentCount: 0,
    attachmentCount: 0,
    ...stamp,
    ...extra,
  }
}

const buildTasks = (): TaskView[] => [
  task("t1", "l1", 1000, {
    title: "Enviar relatório semanal",
    priority: "high",
    due_at: at(0, 20),
    due_has_time: true,
    swatch: "tinta-verso",
    tagIds: ["g1", "g3"],
    checklistTotal: 3,
    checklistDone: 1,
    commentCount: 1,
  }),
  task("t2", "l1", 2000, { title: "Marcar consulta de rotina", priority: "medium", due_at: at(2, 15), swatch: "lima", tagIds: ["g2"] }),
  task("t3", "l1", 3000, { title: "Pagar a conta de luz", priority: "high", due_at: at(-2, 15) }),
  task("t4", "l2", 1000, {
    title: "Planejar as férias",
    priority: "low",
    due_at: at(9, 15),
    swatch: "papel",
    tagIds: ["g2"],
    checklistTotal: 2,
    checklistDone: 1,
    attachmentCount: 2,
  }),
  task("t5", "l3", 1000, { title: "Renovar documento", completed_at: at(-2, 15), due_at: at(-3, 15) }),
]

const buildData = (): BoardData => ({
  board: { id: BOARD, user_id: USER, name: "Meu quadro", position: 1000, archived: false, ...stamp },
  boards: [{ id: BOARD, name: "Meu quadro" }],
  lists,
  tasks: buildTasks(),
  tags,
  timezone: "America/Sao_Paulo",
})

type Props = { searchParams: Promise<{ visao?: string }> }

async function Showcase({ searchParams }: Props) {
  // Fictional dates are relative to "now", so render at request time.
  await connection()
  const { visao } = await searchParams
  const view: ViewMode = visao === "lista" || visao === "calendario" ? visao : "kanban"

  return (
    <div className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-16 md:px-6 lg:px-10">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <ThemeToggle />
      </header>
      <div className="flex flex-col gap-1 pb-6">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
          Tarefas — pré-visualização
        </h1>
        <p className="text-base leading-6 text-muted-foreground">
          Dados fictícios para revisar o visual. As alterações não são salvas.
        </p>
      </div>
      <BoardClient initial={buildData()} userId={USER} initialView={view} nowIso={new Date().toISOString()} />
    </div>
  )
}

export default function TasksShowcasePage(props: Props) {
  return (
    <Suspense fallback={null}>
      <Showcase {...props} />
    </Suspense>
  )
}
