import { describe, expect, it } from "vitest"

import {
  applyFilters,
  countActiveFilters,
  EMPTY_FILTERS,
  groupByList,
  moveWithin,
  sortTasks,
} from "./filters"
import type { ListRow, TaskView } from "./types"

const TZ = "America/Sao_Paulo"
// 2026-03-10 15:00 in São Paulo
const NOW = new Date("2026-03-10T18:00:00Z")

function task(overrides: Partial<TaskView>): TaskView {
  return {
    id: "t",
    user_id: "u",
    board_id: "b",
    list_id: "l1",
    title: "Tarefa",
    description: null,
    priority: "none",
    due_at: null,
    due_has_time: false,
    category: null,
    swatch: "neutro",
    position: 1000,
    completed_at: null,
    archived: false,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    tagIds: [],
    checklistTotal: 0,
    checklistDone: 0,
    commentCount: 0,
    attachmentCount: 0,
    ...overrides,
  }
}

const ctx = { now: NOW, timeZone: TZ }

describe("applyFilters", () => {
  const tasks = [
    task({ id: "a", title: "Pagar conta de luz", priority: "high", due_at: "2026-03-09T15:00:00Z" }),
    task({ id: "b", title: "Reunião com o time", priority: "low", due_at: "2026-03-10T20:00:00Z" }),
    task({ id: "c", title: "Planejar férias", tagIds: ["t1"], due_at: "2026-03-14T15:00:00Z" }),
    task({ id: "d", title: "Renovar documento", completed_at: "2026-03-08T12:00:00Z", list_id: "l2" }),
  ]

  it("matches the search ignoring case and accents", () => {
    const ids = applyFilters(tasks, { ...EMPTY_FILTERS, query: "reuniao" }, ctx).map((t) => t.id)
    expect(ids).toEqual(["b"])
  })

  it("filters by priority and tag", () => {
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, priorities: ["high"] }, ctx).map((t) => t.id)).toEqual(["a"])
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, tagIds: ["t1"] }, ctx).map((t) => t.id)).toEqual(["c"])
  })

  it("filters overdue, today, week and undated tasks in the user's timezone", () => {
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, due: "overdue" }, ctx).map((t) => t.id)).toEqual(["a"])
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, due: "today" }, ctx).map((t) => t.id)).toEqual(["b"])
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, due: "week" }, ctx).map((t) => t.id)).toEqual(["b", "c"])
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, due: "none" }, ctx).map((t) => t.id)).toEqual(["d"])
  })

  it("hides completed tasks and filters by list", () => {
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, showCompleted: false }, ctx).map((t) => t.id)).not.toContain("d")
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, listIds: ["l2"] }, ctx).map((t) => t.id)).toEqual(["d"])
  })

  it("counts active filters without counting the search text", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
    expect(countActiveFilters({ ...EMPTY_FILTERS, query: "x", priorities: ["low"], due: "today" })).toBe(2)
  })
})

describe("sortTasks", () => {
  const tasks = [
    task({ id: "a", title: "Zebra", priority: "low", position: 3000, due_at: "2026-03-12T12:00:00Z" }),
    task({ id: "b", title: "Árvore", priority: "high", position: 1000 }),
    task({ id: "c", title: "Maçã", priority: "medium", position: 2000, due_at: "2026-03-11T12:00:00Z" }),
  ]

  it("sorts by manual position", () => {
    expect(sortTasks(tasks, "manual").map((t) => t.id)).toEqual(["b", "c", "a"])
  })

  it("sorts by due date with undated tasks last", () => {
    expect(sortTasks(tasks, "due").map((t) => t.id)).toEqual(["c", "a", "b"])
  })

  it("sorts by priority, high first", () => {
    expect(sortTasks(tasks, "priority").map((t) => t.id)).toEqual(["b", "c", "a"])
  })

  it("sorts by title using pt-BR collation", () => {
    expect(sortTasks(tasks, "title").map((t) => t.id)).toEqual(["b", "c", "a"])
  })
})

describe("groupByList / moveWithin", () => {
  it("groups tasks by list keeping empty lists", () => {
    const lists = [{ id: "l1" }, { id: "l2" }] as ListRow[]
    const groups = groupByList([task({ id: "a" }), task({ id: "b", list_id: "l2" })], lists)
    expect(groups.get("l1")?.map((t) => t.id)).toEqual(["a"])
    expect(groups.get("l2")?.map((t) => t.id)).toEqual(["b"])
  })

  it("moves an id to a new index", () => {
    expect(moveWithin(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"])
    expect(moveWithin(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"])
    expect(moveWithin(["a", "b"], "z", 9)).toEqual(["a", "b", "z"])
  })
})
