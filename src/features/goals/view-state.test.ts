import { describe, expect, it } from "vitest"

import { DEFAULT_VIEW, allCollapsed, isCollapsed, parseGoalView, setAllCollapsed, toggleCollapsed } from "./view-state"

describe("goal view state", () => {
  it("starts expanded with the Concluídas section closed", () => {
    expect(DEFAULT_VIEW).toEqual({ collapsed: [], doneOpen: false })
  })

  it("keeps valid saved values and ignores garbage", () => {
    expect(parseGoalView({ collapsed: ["a", "a", 3], doneOpen: true })).toEqual({ collapsed: ["a"], doneOpen: true })
    for (const bad of [null, undefined, 5, "x", { collapsed: "a", doneOpen: "yes" }]) expect(parseGoalView(bad)).toEqual(DEFAULT_VIEW)
  })

  it("toggles one goal without touching the others", () => {
    const one = toggleCollapsed(DEFAULT_VIEW, "a")
    expect(isCollapsed(one, "a")).toBe(true)
    expect(toggleCollapsed(toggleCollapsed(one, "b"), "a").collapsed).toEqual(["b"])
  })

  it("collapses and expands all", () => {
    const view = setAllCollapsed(DEFAULT_VIEW, ["a", "b"], true)
    expect(view.collapsed).toEqual(["a", "b"])
    expect(allCollapsed(view, ["a", "b"])).toBe(true)
    expect(allCollapsed(view, ["a", "b", "c"])).toBe(false)
    expect(allCollapsed(view, [])).toBe(false)
    expect(setAllCollapsed(view, ["a", "b"], false).collapsed).toEqual([])
  })
})
