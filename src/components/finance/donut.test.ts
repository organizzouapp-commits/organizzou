import { describe, expect, it } from "vitest"

import { donutArcs } from "./bento"

const C = 2 * Math.PI * 44

describe("donutArcs", () => {
  it("draws nothing for no values and ignores zeros", () => {
    expect(donutArcs([], C)).toEqual([])
    expect(donutArcs([0, 0], C)).toEqual([])
    expect(donutArcs([0, 5], C)).toHaveLength(1)
  })

  it("fills the whole ring for one segment, with no gap", () => {
    const [arc] = donutArcs([7], C)
    expect(arc.dash).toBeCloseTo(C, 5)
  })

  it("leaves a constant 2.5° gap and covers the whole circumference", () => {
    const arcs = donutArcs([50, 30, 20], C)
    const gap = (2.5 / 360) * C
    const covered = arcs.reduce((sum, a) => sum + a.dash + gap, 0)
    expect(covered).toBeCloseTo(C, 4)
  })

  it("gives a tiny slice at least 1.5% and never overlaps the next one", () => {
    const arcs = donutArcs([10_000, 1], C)
    expect(arcs[1].dash + (2.5 / 360) * C).toBeGreaterThanOrEqual(0.015 * C - 0.5)
    expect(arcs[0].offset + arcs[0].dash).toBeLessThanOrEqual(arcs[1].offset + 0.001)
  })
})
