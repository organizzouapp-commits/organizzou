import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { WithNow } from "@/components/mock/with-now"
import { ServerBoard } from "@/components/tasks/server-board"
import { MockBoard } from "@/components/tasks/mock-board"
import type { ViewMode } from "@/components/tasks/board-toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { getBoardData } from "@/features/tasks/queries"
import { isMock } from "@/mocks/config"
import { getSession } from "@/lib/supabase/session"

export const metadata: Metadata = { title: "Tarefas — Organizzou" }

type Props = {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{ visao?: string }>
}

function parseView(value: string | undefined): ViewMode {
  return value === "lista" || value === "calendario" ? value : "kanban"
}

async function BoardContent({ params, searchParams }: Props) {
  const [{ boardId }, { visao }] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(boardId)) notFound()

  if (isMock) {
    return (
      <WithNow>
        {(nowIso) => <MockBoard boardId={boardId} initialView={parseView(visao)} nowIso={nowIso} />}
      </WithNow>
    )
  }

  const [{ userId }, data] = await Promise.all([getSession(), getBoardData(boardId)])
  if (!data) notFound()

  return (
    <ServerBoard key={boardId} initial={data} userId={userId} initialView={parseView(visao)} nowIso={new Date().toISOString()} />
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
      <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.02em] md:text-[28px] md:leading-[34px]">
        Tarefas
      </h1>
      <Suspense fallback={<BoardSkeleton />}>
        <BoardContent {...props} />
      </Suspense>
    </div>
  )
}
