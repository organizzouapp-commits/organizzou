"use client"

import { useMemo } from "react"

import { createServerBoardApi } from "@/features/tasks/server-api"
import type { BoardData } from "@/features/tasks/types"

import { BoardClient } from "./board-client"
import type { ViewMode } from "./board-toolbar"

type ServerBoardProps = { initial: BoardData; userId: string; initialView: ViewMode; nowIso: string }

/** Real backend wrapper (Supabase server actions + Storage). */
export function ServerBoard({ initial, userId, initialView, nowIso }: ServerBoardProps) {
  const api = useMemo(() => createServerBoardApi(userId), [userId])
  return <BoardClient initial={initial} api={api} initialView={initialView} nowIso={nowIso} />
}
