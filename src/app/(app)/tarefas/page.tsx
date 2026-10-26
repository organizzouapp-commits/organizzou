import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SquareKanbanIcon } from "lucide-react"

import { CreateFirstBoard } from "@/components/tasks/create-first-board"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { getBoards } from "@/features/tasks/queries"
import { isMock } from "@/mocks/config"
import { FIRST_MOCK_BOARD_ID } from "@/mocks/tasks-api"

export const metadata: Metadata = { title: "Tarefas — Organizzou" }

async function FirstBoardRedirect() {
  if (isMock) redirect(`/tarefas/${FIRST_MOCK_BOARD_ID}`)

  const boards = await getBoards()
  if (boards.length > 0) redirect(`/tarefas/${boards[0].id}`)

  return (
    <EmptyState
      icon={SquareKanbanIcon}
      title="Nenhum quadro ainda"
      description="Crie um quadro para organizar suas tarefas em listas."
      action={<CreateFirstBoard />}
    />
  )
}

export default function TasksIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <FirstBoardRedirect />
      </Suspense>
    </div>
  )
}
