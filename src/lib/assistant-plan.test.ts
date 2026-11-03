import { describe, expect, it } from "vitest"

import { canUseAssistant } from "./plans"

describe("canUseAssistant", () => {
  it("is a Pro feature", () => {
    expect(canUseAssistant("pro")).toBe(true)
    expect(canUseAssistant("free")).toBe(false)
  })
})
