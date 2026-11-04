import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ServerBoard } from "@/components/tasks/server-board"
import type { ViewMode } from "@/components/tasks/board-toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { getBoardData } from "@/features/tasks/queries"
import { getSession } from "@/lib/supabase/session"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { boardId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(boardId)) return { title: "Tarefas" }
  const data = await getBoardData(boardId)
  return { title: data?.board.name || "Tarefas" }
}

type Props = {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{ view?: string; visao?: string }>
}

/** The view named in the URL; null lets the screen pick (the device's last view, else Lista on phones and Kanban on desktop). */
function parseView(value: string | undefined): ViewMode | null {
  return value === "kanban" || value === "lista" || value === "calendario" ? value : value === "agenda" ? "calendario" : null
}

async function BoardContent({ params, searchParams }: Props) {
  const [{ boardId }, { view, visao }] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(boardId)) notFound()

  const [{ userId }, data] = await Promise.all([getSession(), getBoardData(boardId)])
  if (!data) notFound()

  return (
    <ServerBoard key={boardId} initial={data} userId={userId} initialView={parseView(view ?? visao)} nowIso={new Date().toISOString()} />
  )
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-11 w-64" />
      <Skeleton className="h-11 w-full" />
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 w-72 shrink-0" />
        ))}
      </div>
    </div>
  )
}

export default function BoardPage(props: Props) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<BoardSkeleton />}>
        <BoardContent {...props} />
      </Suspense>
    </div>
  )
}
