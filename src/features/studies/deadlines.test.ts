import { describe, expect, it } from "vitest"

import { dayBlock, daysLeft, formatBR, formatLong, formatShort, groupDeadlines, groupOf, monthCells, monthTitle, nextDeadline, parseDate, parseQuickAdd, shiftMonth, typeOf } from "./deadlines"

const TODAY = "2026-11-09"

describe("daysLeft", () => {
  it("counts whole days, negative when overdue", () => {
    expect(daysLeft("2026-11-09", TODAY)).toBe(0)
    expect(daysLeft("2026-11-12", TODAY)).toBe(3)
    expect(daysLeft("2026-11-08", TODAY)).toBe(-1)
  })
  it("crosses months, years and leap days exactly", () => {
    expect(daysLeft("2027-01-01", "2026-12-31")).toBe(1)
    expect(daysLeft("2028-03-01", "2028-02-28")).toBe(2)
    expect(daysLeft("2026-12-25", TODAY)).toBe(46)
  })
  it("does not depend on the device timezone (pure date parts)", () => {
    const original = process.env.TZ
    for (const tz of ["America/Sao_Paulo", "UTC", "Pacific/Auckland", "Asia/Tokyo"]) {
      process.env.TZ = tz
      expect(daysLeft("2026-11-12", "2026-11-09")).toBe(3)
      expect(daysLeft("2026-10-18", "2026-10-17")).toBe(1) // the day Brazil used to change its clocks
    }
    process.env.TZ = original
  })
})

describe("grouping", () => {
  it("assigns each deadline to a group", () => {
    expect(groupOf("2026-11-08", TODAY, false)).toBe("week") // overdue is the most urgent
    expect(groupOf("2026-11-16", TODAY, false)).toBe("week") // 7 days
    expect(groupOf("2026-11-17", TODAY, false)).toBe("month")
    expect(groupOf("2026-11-30", TODAY, false)).toBe("month")
    expect(groupOf("2026-12-01", TODAY, false)).toBe("later")
    expect(groupOf("2026-11-10", TODAY, true)).toBe("done")
  })
  it("orders the groups and the items, leaving empty groups out", () => {
    const items = [
      { id: "a", due_on: "2027-02-01" },
      { id: "b", due_on: "2026-11-10" },
      { id: "c", due_on: "2026-11-25" },
      { id: "d", due_on: "2026-11-09" },
      { id: "e", due_on: "2026-11-01" },
      { id: "f", due_on: "2026-11-20" },
    ]
    const groups = groupDeadlines(items, { e: { done: true }, f: { done: true } }, TODAY)
    expect(groups.map((g) => g.id)).toEqual(["week", "month", "later", "done"])
    expect(groups[0].items.map((i) => i.id)).toEqual(["d", "b"])
    expect(groups[3].items.map((i) => i.id)).toEqual(["f", "e"]) // most recent first
    expect(groupDeadlines([{ id: "x", due_on: "2027-02-01" }], {}, TODAY).map((g) => g.id)).toEqual(["later"])
    expect(groupDeadlines([], {}, TODAY)).toEqual([])
  })
  it("finds the next open deadline", () => {
    const items = [{ id: "a", due_on: "2026-11-01" }, { id: "b", due_on: "2026-11-12" }, { id: "c", due_on: "2026-11-10" }]
    expect(nextDeadline(items, {}, TODAY)?.id).toBe("c")
    expect(nextDeadline(items, { c: { done: true } }, TODAY)?.id).toBe("b")
    expect(nextDeadline([], {}, TODAY)).toBeNull()
  })
  it("reads the type, with Outro stored apart", () => {
    expect(typeOf({ kind: "exam" })).toBe("exam")
    expect(typeOf({ kind: "exam" }, { other: true })).toBe("other")
  })
})

describe("dayBlock", () => {
  it("builds the 56 px block", () => {
    expect(dayBlock(3)).toEqual({ kind: "soon", big: "3", small: "dias", solid: true })
    expect(dayBlock(1)).toEqual({ kind: "soon", big: "1", small: "dia", solid: true })
    expect(dayBlock(4)).toEqual({ kind: "later", big: "4", small: "dias", solid: false })
    expect(dayBlock(0)).toMatchObject({ kind: "today", big: "hoje", solid: true })
    expect(dayBlock(-2)).toEqual({ kind: "overdue", big: "2", small: "atrasado", solid: false })
  })
})

describe("pt-BR formatting", () => {
  it("formats days", () => {
    expect(formatLong("2026-11-12")).toBe("quinta-feira, 12 de novembro")
    expect(formatShort("2026-11-09")).toBe("9 nov")
    expect(formatBR("2026-03-05")).toBe("05/03/2026")
    expect(monthTitle("2026-11")).toBe("novembro de 2026")
  })
})

describe("parseDate", () => {
  it("reads day and month names", () => {
    expect(parseDate("20 de nov", TODAY)).toBe("2026-11-20")
    expect(parseDate("20 nov", TODAY)).toBe("2026-11-20")
    expect(parseDate("20 de novembro de 2027", TODAY)).toBe("2027-11-20")
    expect(parseDate("3 de março", TODAY)).toBe("2027-03-03") // already passed this year → next year
    expect(parseDate("1 de dez.", TODAY)).toBe("2026-12-01")
  })
  it("reads numeric dates", () => {
    expect(parseDate("20/11", TODAY)).toBe("2026-11-20")
    expect(parseDate("20/11/2026", TODAY)).toBe("2026-11-20")
    expect(parseDate("5/1/27", TODAY)).toBe("2027-01-05")
  })
  it("reads hoje and amanhã", () => {
    expect(parseDate("hoje", TODAY)).toBe(TODAY)
    expect(parseDate("Amanhã", TODAY)).toBe("2026-11-10")
  })
  it("keeps today and rejects what is not a date", () => {
    expect(parseDate("9 de nov", TODAY)).toBe(TODAY)
    expect(parseDate("31 de nov", TODAY)).toBeNull()
    expect(parseDate("30/02", TODAY)).toBeNull()
    expect(parseDate("banana", TODAY)).toBeNull()
    expect(parseDate("", TODAY)).toBeNull()
  })
})

describe("parseQuickAdd", () => {
  it("splits the title from a trailing date", () => {
    expect(parseQuickAdd("Prova de Cálculo, 20 de nov", TODAY)).toEqual({ title: "Prova de Cálculo", date: "2026-11-20" })
    expect(parseQuickAdd("Entrega, do trabalho, 15/12", TODAY)).toEqual({ title: "Entrega, do trabalho", date: "2026-12-15" })
  })
  it("falls back to the whole text as the title", () => {
    expect(parseQuickAdd("Prova de Cálculo, em breve", TODAY)).toEqual({ title: "Prova de Cálculo, em breve", date: null })
    expect(parseQuickAdd("  Seminário ", TODAY)).toEqual({ title: "Seminário", date: null })
    expect(parseQuickAdd(", 20 nov", TODAY)).toEqual({ title: ", 20 nov", date: null })
  })
})

describe("month calendar", () => {
  it("lays out a month from Sunday", () => {
    const cells = monthCells("2026-11") // November 1st 2026 is a Sunday
    expect(cells[0]).toBe("2026-11-01")
    expect(cells).toHaveLength(30)
    const feb = monthCells("2026-07") // July 1st 2026 is a Wednesday
    expect(feb.slice(0, 4)).toEqual([null, null, null, "2026-07-01"])
    expect(feb).toHaveLength(34)
  })
  it("moves between months across years", () => {
    expect(shiftMonth("2026-11", 1)).toBe("2026-12")
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
  })
})
