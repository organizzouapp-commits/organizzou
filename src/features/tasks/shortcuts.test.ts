import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import { countForShortcut, criteriaToFilters, DEFAULT_SHORTCUTS, EMPTY_CRITERIA, isActiveShortcut, parseShortcuts, type ShortcutDef } from "./shortcuts"
import type { TaskView } from "./types"

const context = { now: new Date("2026-11-03T15:00:00Z"), timeZone: "America/Sao_Paulo" }
const task = (over: Partial<TaskView>): TaskView => ({ id: "t", board_id: "b", list_id: "l1", title: "x", description: null, priority: "none", due_at: null, due_has_time: false, completed_at: null, archived: false, position: 0, swatch: "neutro", category: null, user_id: "u", created_at: "", updated_at: "", tagIds: [], checklistTotal: 0, checklistDone: 0, commentCount: 0, attachmentCount: 0, ...over }) as TaskView

describe("shortcuts storage", () => {
  it("falls back to the defaults for empty or broken data", () => {
    expect(parseShortcuts(null)).toEqual(DEFAULT_SHORTCUTS)
    expect(parseShortcuts("{nope")).toEqual(DEFAULT_SHORTCUTS)
    expect(parseShortcuts('{"a":1}')).toEqual(DEFAULT_SHORTCUTS)
  })

  it("keeps order, hidden flags and custom shortcuts, and brings missing built-ins back", () => {
    const custom: ShortcutDef = { id: "custom-1", label: "Alta e do trabalho", builtin: false, hidden: false, pinned: true, criteria: { ...EMPTY_CRITERIA, tagIds: ["tag-1"] } }
    const saved = [custom, { ...DEFAULT_SHORTCUTS[1], hidden: true }, DEFAULT_SHORTCUTS[0]]
    const parsed = parseShortcuts(JSON.stringify(saved))
    expect(parsed.map((s) => s.id).slice(0, 3)).toEqual(["custom-1", "hoje", "todas"])
    expect(parsed[1].hidden).toBe(true)
    expect(parsed[0].criteria.tagIds).toEqual(["tag-1"])
    expect(parsed.map((s) => s.id)).toContain("atrasadas")
  })

  it("does not let a saved entry rename a built-in", () => {
    const parsed = parseShortcuts(JSON.stringify([{ ...DEFAULT_SHORTCUTS[1], label: "Outro nome" }]))
    expect(parsed.find((s) => s.id === "hoje")?.label).toBe("Hoje")
  })
})

describe("shortcut matching", () => {
  it("counts only pending tasks that match the criteria", () => {
    const def: ShortcutDef = { id: "c", label: "Altas", builtin: false, hidden: false, pinned: false, criteria: { ...EMPTY_CRITERIA, tagIds: ["alta"] } }
    const tasks = [task({ id: "1", tagIds: ["alta"] }), task({ id: "2", tagIds: ["alta"], completed_at: "2026-11-01T00:00:00Z" }), task({ id: "3" })]
    expect(countForShortcut(def, tasks, context)).toBe(1)
  })

  it("matches a day range and categories", () => {
    const def: ShortcutDef = { id: "c", label: "Semana que vem", builtin: false, hidden: false, pinned: false, criteria: { ...EMPTY_CRITERIA, due: "all", range: { from: "2026-11-09", to: "2026-11-15" }, categories: ["Casa"] } }
    const tasks = [task({ id: "1", due_at: "2026-11-10T15:00:00Z", category: "Casa" }), task({ id: "2", due_at: "2026-11-10T15:00:00Z", category: "Trabalho" }), task({ id: "3", due_at: "2026-11-20T15:00:00Z", category: "Casa" })]
    expect(countForShortcut(def, tasks, context)).toBe(1)
  })

  it("knows which shortcut the current filters equal", () => {
    const hoje = DEFAULT_SHORTCUTS[1]
    expect(isActiveShortcut(hoje, criteriaToFilters(hoje.criteria, EMPTY_FILTERS))).toBe(true)
    expect(isActiveShortcut(hoje, { ...EMPTY_FILTERS, due: "today", tagIds: ["x"] })).toBe(false)
    expect(isActiveShortcut(DEFAULT_SHORTCUTS[0], EMPTY_FILTERS)).toBe(true)
  })
})

describe("visibleShortcuts", () => {
  it("lists every enabled shortcut in order, even with nothing pending", async () => {
    const { visibleShortcuts, DEFAULT_SHORTCUTS: defaults } = await import("./shortcuts")
    expect(visibleShortcuts(defaults).map((s) => s.id)).toEqual(["todas", "hoje", "semana", "atrasadas", "sem-data"])
    const edited = defaults.map((s) => (s.id === "hoje" ? { ...s, hidden: true } : s))
    expect(visibleShortcuts(edited).map((s) => s.id)).toEqual(["todas", "semana", "atrasadas", "sem-data"])
  })
})

describe("shortcut sort", () => {
  it("a saved filter keeps a non-default sort and the parser accepts only known sorts", async () => {
    const { filtersToCriteria, parseShortcuts, EMPTY_CRITERIA } = await import("./shortcuts")
    const { EMPTY_FILTERS } = await import("./filters")
    expect(filtersToCriteria(EMPTY_FILTERS, "due").sort).toBe("due")
    expect(filtersToCriteria(EMPTY_FILTERS, "manual").sort).toBeUndefined()
    const raw = JSON.stringify([
      { id: "custom-1", label: "A", hidden: false, criteria: { ...EMPTY_CRITERIA, sort: "title" } },
      { id: "custom-2", label: "B", hidden: false, criteria: { ...EMPTY_CRITERIA, sort: "nope" } },
    ])
    const parsed = parseShortcuts(raw)
    expect(parsed.find((s) => s.id === "custom-1")?.criteria.sort).toBe("title")
    expect(parsed.find((s) => s.id === "custom-2")?.criteria.sort).toBeUndefined()
  })
})
