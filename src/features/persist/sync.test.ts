import { describe, expect, it } from "vitest"

import { shouldAdoptServerRows } from "./sync"

const rows = [{ id: "goal", target_weight_kg: null }]

describe("shouldAdoptServerRows", () => {
  it("does not adopt a new array with the same content (the bug that undid a saved weight goal)", () => {
    const first = JSON.stringify(rows)
    const saved = JSON.stringify([{ id: "goal", target_weight_kg: 75 }])
    expect(shouldAdoptServerRows({ lastSeenJson: first, incoming: [...rows.map((r) => ({ ...r }))], hasUnsentChanges: false, shownJson: saved })).toEqual({ adopt: false, seenJson: first })
  })

  it("adopts rows that really changed on the server", () => {
    const result = shouldAdoptServerRows({ lastSeenJson: "[]", incoming: rows, hasUnsentChanges: false, shownJson: "[]" })
    expect(result.adopt).toBe(true)
  })

  it("keeps the screen's own unsent changes", () => {
    expect(shouldAdoptServerRows({ lastSeenJson: "[]", incoming: rows, hasUnsentChanges: true, shownJson: "[1]" }).adopt).toBe(false)
  })

  it("does nothing when the server rows equal what is shown", () => {
    expect(shouldAdoptServerRows({ lastSeenJson: "[]", incoming: rows, hasUnsentChanges: false, shownJson: JSON.stringify(rows) }).adopt).toBe(false)
  })
})
