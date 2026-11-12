import { describe, expect, it } from "vitest"

import { moveChecklistItem, positionBetween } from "./checklist-order"

const items = [
  { id: "a", position: 1000 },
  { id: "b", position: 2000 },
  { id: "c", position: 3000 },
]

describe("positionBetween", () => {
  it("sits between neighbours and steps at the ends", () => {
    expect(positionBetween(1000, 2000)).toBe(1500)
    expect(positionBetween(undefined, 1000)).toBe(0)
    expect(positionBetween(3000, undefined)).toBe(4000)
    expect(positionBetween(undefined, undefined)).toBe(1000)
  })
})

describe("moveChecklistItem", () => {
  it("moves down and gives the item a position between its new neighbours", () => {
    const result = moveChecklistItem(items, "a", "b")
    expect(result?.items.map((i) => i.id)).toEqual(["b", "a", "c"])
    expect(result?.moved).toEqual({ id: "a", position: 2500 })
  })
  it("moves to the top and to the bottom", () => {
    expect(moveChecklistItem(items, "c", "a")?.items.map((i) => i.id)).toEqual(["c", "a", "b"])
    expect(moveChecklistItem(items, "c", "a")?.moved.position).toBe(0)
    expect(moveChecklistItem(items, "a", "c")?.moved.position).toBe(4000)
  })
  it("does nothing for the same or an unknown item", () => {
    expect(moveChecklistItem(items, "a", "a")).toBeNull()
    expect(moveChecklistItem(items, "a", "zzz")).toBeNull()
  })
})
