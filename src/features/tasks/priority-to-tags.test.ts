import { describe, expect, it } from "vitest"

import { DEFAULT_PRIORITY_STATE } from "./priorities"
import { planPriorityTags, tagIdsForLegacyPriorities } from "./priority-to-tags"

const task = (id: string, priority: string, tagIds: string[] = []) => ({ id, priority, tagIds })

describe("priorities become tags", () => {
  it("creates one tag per distinct priority, reuses same-name tags case-insensitively, and never duplicates", () => {
    const plan = planPriorityTags({
      tasks: [task("a", "high"), task("b", "high"), task("c", "low"), task("d", "none"), task("e", "medium", ["t-media"])],
      priorities: DEFAULT_PRIORITY_STATE,
      tags: [{ id: "t-media", name: "MÉDIA" }],
      colorOf: (id) => (id === "alta" ? "#E5484D" : null),
    })
    expect(plan.create).toEqual([
      { name: "Alta", color: "#E5484D" },
      { name: "Baixa", color: null },
    ])
    // "d" has no priority: nothing. "e" already carries the (reused) tag: skipped.
    expect(plan.assign.map((a) => a.taskId)).toEqual(["a", "b", "c"])
  })

  it("reuses an existing tag that the task does not carry yet", () => {
    const plan = planPriorityTags({ tasks: [task("a", "medium")], priorities: DEFAULT_PRIORITY_STATE, tags: [{ id: "t1", name: "média" }], colorOf: () => null })
    expect(plan.create).toEqual([])
    expect(plan.assign).toEqual([{ taskId: "a", key: "média" }])
  })

  it("is idempotent once the tags are on the tasks", () => {
    const plan = planPriorityTags({ tasks: [task("a", "high", ["t-alta"])], priorities: DEFAULT_PRIORITY_STATE, tags: [{ id: "t-alta", name: "Alta" }], colorOf: () => null })
    expect(plan).toEqual({ create: [], assign: [] })
  })

  it("converts legacy shortcut priorities into tag ids", () => {
    expect(tagIdsForLegacyPriorities(["high", "low", "none"], [{ id: "x", name: "alta" }, { id: "y", name: "Baixa" }])).toEqual(["x", "y"])
  })
})
