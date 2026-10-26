"use client"

import { useState } from "react"

import { createMockBoardApi, getMockBoardsStore } from "@/mocks/tasks-api"
import type { BoardData } from "@/features/tasks/types"

import { BoardClient } from "./board-client"
import type { ViewMode } from "./board-toolbar"

type MockBoardProps = { boardId: string; initialView: ViewMode; nowIso: string }

/** Prototype wrapper: the same BoardClient, backed by the in-memory mock API. */
export function MockBoard({ boardId, initialView, nowIso }: MockBoardProps) {
  const [{ api, initial }] = useState(() => {
    const store = getMockBoardsStore(nowIso)
    const board = store.boards.find((b) => b.board.id === boardId) ?? store.boards[0]
    const boards = store.boards.filter((b) => !store.archived.has(b.board.id)).map((b) => ({ id: b.board.id, name: b.board.name }))
    const initial: BoardData = { ...board, boards, tags: store.tags }
    return { api: createMockBoardApi(nowIso), initial }
  })

  return <BoardClient key={initial.board.id} initial={initial} api={api} initialView={initialView} nowIso={nowIso} />
}
