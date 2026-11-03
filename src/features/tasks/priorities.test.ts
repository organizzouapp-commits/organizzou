import { describe, expect, it } from "vitest"

import { DEFAULT_PRIORITY_STATE, enumFor, isTopHalf, parsePriorityState, priorityOf, SEED_PRIORITIES, usageOf } from "./priorities"

const task = (id: string, priority: "none" | "low" | "medium" | "high") => ({ id, priority })

describe("priorities", () => {
  it("falls back to the seeds for empty or broken storage", () => {
    expect(parsePriorityState(null)).toEqual(DEFAULT_PRIORITY_STATE)
    expect(parsePriorityState("{oops")).toEqual(DEFAULT_PRIORITY_STATE)
    expect(parsePriorityState('{"list":"x"}')).toEqual(DEFAULT_PRIORITY_STATE)
  })

  it("drops assignments to priorities that no longer exist", () => {
    const parsed = parsePriorityState(JSON.stringify({ list: [{ id: "a", name: " Alta " }], assigned: { t1: "a", t2: "gone" } }))
    expect(parsed.list).toEqual([{ id: "a", name: "Alta" }])
    expect(parsed.assigned).toEqual({ t1: "a" })
  })

  it("shows the assigned priority, else the one the stored enum stands for, else none", () => {
    const state = { ...DEFAULT_PRIORITY_STATE, assigned: { t1: "urgente" } }
    expect(priorityOf(state, task("t1", "high"))?.name).toBe("Urgente")
    expect(priorityOf(state, task("t2", "high"))?.name).toBe("Alta")
    expect(priorityOf(state, task("t3", "none"))).toBeNull()
    // A deleted priority makes the task fall back to "Sem prioridade".
    const without = { list: SEED_PRIORITIES.filter((p) => p.id !== "alta"), assigned: {} }
    expect(priorityOf(without, task("t4", "high"))).toBeNull()
  })

  it("keeps the stored enum consistent with the weight of the priority", () => {
    expect(enumFor(SEED_PRIORITIES, null)).toBe("none")
    expect(enumFor(SEED_PRIORITIES, "baixa")).toBe("low")
    expect(enumFor(SEED_PRIORITIES, "media")).toBe("medium")
    expect(enumFor(SEED_PRIORITIES, "alta")).toBe("high")
    expect(enumFor(SEED_PRIORITIES, "urgente")).toBe("high")
  })

  it("fills the flag for the heavier half", () => {
    expect(SEED_PRIORITIES.map((p) => isTopHalf(SEED_PRIORITIES, p.id))).toEqual([false, false, true, true])
  })

  it("counts the tasks that use a priority", () => {
    const state = { ...DEFAULT_PRIORITY_STATE, assigned: { t1: "urgente" } }
    expect(usageOf(state, [task("t1", "high"), task("t2", "high"), task("t3", "low")], "alta")).toBe(1)
    expect(usageOf(state, [task("t1", "high")], "urgente")).toBe(1)
  })
})
