import { describe, expect, it } from "vitest"

import { countPending, dueGroupOf, groupByDue, isPending, shortcutCounts, showsFlag } from "./view"
import type { TaskView } from "./types"

const NOW = new Date("2026-11-03T15:00:00-03:00")
const ctx = { now: NOW, timeZone: "America/Sao_Paulo" }

function task(over: Partial<TaskView> & { id: string }): TaskView {
  return {
    user_id: "u",
    board_id: "b",
    list_id: "l",
    title: over.id,
    description: null,
    priority: "none",
    due_at: null,
    due_has_time: false,
    completed_at: null,
    archived: false,
    position: 0,
    swatch: "neutro",
    category: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    tagIds: [],
    checklistTotal: 0,
    checklistDone: 0,
    commentCount: 0,
    attachmentCount: 0,
    ...over,
  } as TaskView
}
const at = (day: string, time = "12:00") => `${day}T${time}:00-03:00`

describe("pending rule", () => {
  it("completed and archived tasks are not pending", () => {
    const list = [task({ id: "a" }), task({ id: "b", completed_at: "2026-11-02T10:00:00Z" }), task({ id: "c", archived: true })]
    expect(list.map(isPending)).toEqual([true, false, false])
    expect(countPending(list)).toBe(1)
  })
})

describe("shortcut counts (pending only)", () => {
  const tasks = [
    task({ id: "late", due_at: at("2026-11-01"), due_has_time: false }),
    task({ id: "late-time", due_at: at("2026-11-03", "09:00"), due_has_time: true }),
    task({ id: "today", due_at: at("2026-11-03", "18:00"), due_has_time: true }),
    task({ id: "week", due_at: at("2026-11-06") }),
    task({ id: "far", due_at: at("2026-12-20") }),
    task({ id: "none" }),
    task({ id: "done-today", due_at: at("2026-11-03"), completed_at: "2026-11-03T10:00:00Z" }),
  ]
  const counts = shortcutCounts(tasks, ctx)
  it("counts every shortcut over pending tasks", () => {
    expect(counts.todas).toBe(6)
    expect(counts.atrasadas).toBe(2)
    expect(counts.hoje).toBe(2)
    expect(counts.semana).toBe(3)
    expect(counts["sem-data"]).toBe(1)
  })
  it("never counts completed tasks", () => {
    expect(shortcutCounts([task({ id: "x", completed_at: "2026-11-03T10:00:00Z", due_at: at("2026-11-03") })], ctx)).toEqual({ todas: 0, hoje: 0, semana: 0, atrasadas: 0, "sem-data": 0 })
  })
})

describe("due groups", () => {
  it("assigns the group of each task", () => {
    expect(dueGroupOf(task({ id: "a", due_at: at("2026-11-01") }), ctx)).toBe("atrasadas")
    expect(dueGroupOf(task({ id: "a", due_at: at("2026-11-03", "20:00"), due_has_time: true }), ctx)).toBe("hoje")
    expect(dueGroupOf(task({ id: "a", due_at: at("2026-11-04") }), ctx)).toBe("amanha")
    expect(dueGroupOf(task({ id: "a", due_at: at("2026-11-08") }), ctx)).toBe("semana")
    expect(dueGroupOf(task({ id: "a", due_at: at("2026-11-20") }), ctx)).toBe("depois")
    expect(dueGroupOf(task({ id: "a" }), ctx)).toBe("sem-data")
    expect(dueGroupOf(task({ id: "a", completed_at: "2026-11-03T10:00:00Z", due_at: at("2026-11-01") }), ctx)).toBe("concluidas")
  })
  it("keeps the fixed order and drops empty groups", () => {
    const groups = groupByDue([task({ id: "n" }), task({ id: "t", due_at: at("2026-11-03", "20:00"), due_has_time: true }), task({ id: "l", due_at: at("2026-11-01") })], ctx)
    expect(groups.map((g) => g.id)).toEqual(["atrasadas", "hoje", "sem-data"])
  })
})

describe("priority flag", () => {
  it("only high priority is flagged", () => {
    expect(["none", "low", "medium", "high"].map(showsFlag)).toEqual([false, false, false, true])
  })
})
