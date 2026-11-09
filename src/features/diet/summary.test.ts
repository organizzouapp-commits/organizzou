import { describe, expect, it } from "vitest"

import { filledPips, kcalText, litersText, macroPercent, remainingKcal, waterPips } from "./summary"

describe("remainingKcal", () => {
  it("is what is left under the goal", () => {
    expect(remainingKcal(128, 2000)).toEqual({ value: 1872, over: false })
    expect(remainingKcal(2000, 2000)).toEqual({ value: 0, over: false })
  })
  it("flips to 'over' past the goal", () => {
    expect(remainingKcal(2150, 2000)).toEqual({ value: 150, over: true })
    expect(remainingKcal(0, 0)).toEqual({ value: 0, over: false })
  })
})

describe("macroPercent", () => {
  it("is consumed over goal in whole percent, capped at 100", () => {
    expect(macroPercent(60, 120)).toBe(50)
    expect(macroPercent(2.5, 120)).toBe(2)
    expect(macroPercent(300, 220)).toBe(100)
  })
  it("is 0 without a goal or without food", () => {
    expect(macroPercent(10, 0)).toBe(0)
    expect(macroPercent(0, 100)).toBe(0)
    expect(macroPercent(-5, 100)).toBe(0)
  })
})

describe("water pips", () => {
  it("are always 10, each worth 10% of the goal", () => {
    expect(waterPips(2500)).toEqual({ count: 10, mlEach: 250 })
    expect(waterPips(0)).toEqual({ count: 10, mlEach: 0 })
  })
  it("fill by the share of the goal reached", () => {
    expect(filledPips(0, 2500)).toBe(0)
    expect(filledPips(250, 2500)).toBe(1)
    expect(filledPips(499, 2500)).toBe(1)
    expect(filledPips(1250, 2500)).toBe(5)
    expect(filledPips(9000, 2500)).toBe(10)
    expect(filledPips(300, 0)).toBe(0)
    expect(filledPips(750, 3000)).toBe(2) // 300 ml each
  })
})

describe("text", () => {
  it("formats litres and kcal in pt-BR", () => {
    expect(litersText(250)).toBe("0,25")
    expect(litersText(2500)).toBe("2,5")
    expect(kcalText(1872)).toBe("1.872")
  })
})
