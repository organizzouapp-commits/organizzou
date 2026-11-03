import { Suspense } from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SquareKanbanIcon } from "lucide-react"

import { CreateFirstBoard } from "@/components/tasks/create-first-board"
import { EmptyState } from "@/components/organizzou/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { getBoards } from "@/features/tasks/queries"

export const metadata: Metadata = { title: "Tarefas" }

async function FirstBoardRedirect() {
  const boards = await getBoards()
  if (boards.length > 0) {
    // The board that opens is never a coin toss: the one the person used last, otherwise the oldest (the default board they got at sign-up).
    const last = (await cookies()).get("tasks_last_board")?.value
    const oldest = [...boards].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0]
    redirect(`/dashboard/tarefas/${boards.find((b) => b.id === last)?.id ?? oldest.id}`)
  }

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
