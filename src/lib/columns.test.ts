import { describe, expect, it } from "vitest"

import { splitColumns } from "./columns"

describe("splitColumns", () => {
  it("alternates items between the columns", () => {
    expect(splitColumns([1, 2, 3, 4, 5], 2)).toEqual([[1, 3, 5], [2, 4]])
  })

  it("keeps one column in order", () => {
    expect(splitColumns([1, 2, 3], 1)).toEqual([[1, 2, 3]])
  })

  it("handles an empty list and a bad count", () => {
    expect(splitColumns([], 2)).toEqual([[], []])
    expect(splitColumns([1, 2], 0)).toEqual([[1, 2]])
    expect(splitColumns([1, 2, 3], 2.9)).toEqual([[1, 3], [2]])
  })
})
