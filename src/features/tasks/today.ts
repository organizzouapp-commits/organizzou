import "server-only"

import { dayDiff, DEFAULT_TIMEZONE, isOverdue } from "@/lib/dates"
import { getSession } from "@/lib/supabase/session"

export type TodayTask = {
  id: string
  title: string
  due_at: string | null
  due_has_time: boolean
  priority: string
  swatch: string
  completed_at: string | null
  boardName: string
  boardId: string
}

export type TodayData = {
  name: string
  timeZone: string
  now: string
  dueToday: TodayTask[]
  overdue: TodayTask[]
  upcoming: TodayTask[]
  doneToday: number
  openTotal: number
}

/** Real data from Tasks for the "Hoje" dashboard. All day boundaries use the profile timezone. */
export async function getTodayData(): Promise<TodayData> {
  const { supabase, userId, email } = await getSession()
  const now = new Date()

  const [profile, boards, tasks] = await Promise.all([
    supabase.from("profiles").select("display_name, timezone").eq("id", userId).maybeSingle(),
    supabase.from("boards").select("id, name, archived"),
    supabase
      .from("tasks")
      .select("id, title, due_at, due_has_time, priority, swatch, completed_at, board_id")
      .eq("archived", false),
  ])

  const timeZone = profile.data?.timezone ?? DEFAULT_TIMEZONE
  const activeBoards = new Map((boards.data ?? []).filter((b) => !b.archived).map((b) => [b.id, b.name]))

  const all: TodayTask[] = (tasks.data ?? [])
    .filter((t) => activeBoards.has(t.board_id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      due_at: t.due_at,
      due_has_time: t.due_has_time,
      priority: t.priority,
      swatch: t.swatch,
      completed_at: t.completed_at,
      boardId: t.board_id,
      boardName: activeBoards.get(t.board_id) ?? "",
    }))

  const byDue = (a: TodayTask, b: TodayTask) =>
    new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime()

  const open = all.filter((t) => !t.completed_at)
  const overdue = open.filter((t) => isOverdue(t, now, timeZone)).sort(byDue)
  const dueToday = open
    .filter((t) => t.due_at && dayDiff(t.due_at, now, timeZone) === 0 && !isOverdue(t, now, timeZone))
    .sort(byDue)
  const upcoming = open
    .filter((t) => {
      if (!t.due_at) return false
      const diff = dayDiff(t.due_at, now, timeZone)
      return diff >= 1 && diff <= 7
    })
    .sort(byDue)
  const doneToday = all.filter((t) => t.completed_at && dayDiff(t.completed_at, now, timeZone) === 0).length

  return {
    name: profile.data?.display_name || email.split("@")[0] || "",
    timeZone,
    now: now.toISOString(),
    dueToday,
    overdue,
    upcoming,
    doneToday,
    openTotal: open.length,
  }
}
