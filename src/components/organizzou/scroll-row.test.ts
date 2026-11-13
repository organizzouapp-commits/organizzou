import { describe, expect, it } from "vitest"

import { centerScrollLeft } from "./scroll-row"

describe("centerScrollLeft", () => {
  it("centers a control in the visible width", () => {
    expect(centerScrollLeft(200, 600, 300, 40)).toBe(220)
  })
  it("stays inside the scrollable range", () => {
    expect(centerScrollLeft(200, 600, 0, 40)).toBe(0)
    expect(centerScrollLeft(200, 600, 580, 40)).toBe(400)
    expect(centerScrollLeft(200, 150, 100, 40)).toBe(0)
  })
})
