import { describe, expect, it } from "vitest"

import { dayNavLabel, weekdayName } from "./day-label"

describe("day labels", () => {
  it("names the weekday in Portuguese without -feira", () => {
    expect(weekdayName("2026-11-09")).toBe("segunda")
    expect(weekdayName("2026-11-10")).toBe("terça")
    expect(weekdayName("2026-11-08")).toBe("domingo")
    expect(weekdayName("2026-11-14")).toBe("sábado")
  })

  it("builds the navigator title", () => {
    expect(dayNavLabel("2026-11-09")).toBe("segunda, 9 de novembro")
    expect(dayNavLabel("2026-03-01")).toBe("domingo, 1 de março")
  })
})
