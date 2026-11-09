import { describe, expect, it } from "vitest"

import { doneThisWeek, groupReminders, longDay, mostOverdue, nextOccurrence, parseReminderText, quickInstant, quickOption, relativeDay, reminderGroup, reminderMeta, upcomingLabel } from "./reminders"

// Monday 9 Nov 2026, 10:00 in São Paulo (UTC-3).
const NOW = new Date("2026-11-09T13:00:00Z")
const at = (day: string, time: string) => new Date(`${day}T${time}:00-03:00`).toISOString()
const r = (id: string, remind_at: string, status: "pending" | "done" = "pending") => ({ id, remind_at, status })

describe("reminderGroup and groupReminders", () => {
  it("puts each reminder in a group by its time", () => {
    expect(reminderGroup(r("a", at("2026-11-03", "17:30")), NOW)).toBe("overdue")
    expect(reminderGroup(r("a", at("2026-11-09", "09:59")), NOW)).toBe("overdue") // earlier today: already passed
    expect(reminderGroup(r("a", at("2026-11-09", "15:00")), NOW)).toBe("today")
    expect(reminderGroup(r("a", at("2026-11-09", "23:59")), NOW)).toBe("today")
    expect(reminderGroup(r("a", at("2026-11-10", "00:01")), NOW)).toBe("later")
    expect(reminderGroup(r("a", at("2026-11-03", "17:30"), "done"), NOW)).toBe("done")
  })
  it("uses the São Paulo day, not the UTC day", () => {
    // 23:30 in São Paulo is already the next day in UTC: it is still "today" here.
    const lateNow = new Date("2026-11-10T02:30:00Z") // Monday 23:30 SP
    expect(reminderGroup(r("a", "2026-11-10T02:45:00Z"), lateNow)).toBe("today")
    expect(reminderGroup(r("a", "2026-11-10T03:05:00Z"), lateNow)).toBe("later") // 00:05 Tuesday SP
  })
  it("sorts the groups", () => {
    const rows = [
      r("late2", at("2026-11-05", "10:00")),
      r("late1", at("2026-11-03", "10:00")),
      r("t2", at("2026-11-09", "20:00")),
      r("t1", at("2026-11-09", "12:00")),
      r("l2", at("2026-11-20", "10:00")),
      r("l1", at("2026-11-11", "10:00")),
      r("d1", at("2026-11-01", "10:00"), "done"),
      r("d2", at("2026-11-02", "10:00"), "done"),
    ]
    const g = groupReminders(rows, NOW)
    expect(g.overdue.map((x) => x.id)).toEqual(["late1", "late2"])
    expect(g.today.map((x) => x.id)).toEqual(["t1", "t2"])
    expect(g.later.map((x) => x.id)).toEqual(["l1", "l2"])
    expect(g.done.map((x) => x.id)).toEqual(["d2", "d1"])
  })
})

describe("mostOverdue and doneThisWeek", () => {
  it("finds the oldest overdue time", () => {
    const rows = [r("a", at("2026-11-05", "10:00")), r("b", at("2026-11-03", "17:30")), r("c", at("2026-11-12", "10:00")), r("d", at("2026-11-01", "10:00"), "done")]
    expect(mostOverdue(rows, NOW)).toBe(at("2026-11-03", "17:30"))
    expect(mostOverdue([r("c", at("2026-11-12", "10:00"))], NOW)).toBeNull()
    expect(longDay(at("2026-11-03", "17:30"))).toBe("3 de novembro")
  })
  it("counts the completed ones of this week (Monday to Sunday)", () => {
    const rows = [r("a", at("2026-11-09", "08:00"), "done"), r("b", at("2026-11-12", "08:00"), "done"), r("c", at("2026-11-08", "08:00"), "done"), r("d", at("2026-11-10", "08:00"))]
    expect(doneThisWeek(rows, NOW)).toBe(2)
  })
})

describe("labels", () => {
  it("uses relative words near today", () => {
    expect(relativeDay(at("2026-11-09", "15:00"), NOW)).toBe("hoje")
    expect(relativeDay(at("2026-11-10", "09:00"), NOW)).toBe("amanhã")
    expect(relativeDay(at("2026-11-08", "09:00"), NOW)).toBe("ontem")
    expect(relativeDay(at("2026-11-11", "09:00"), NOW)).toBe("quarta")
    expect(relativeDay(at("2026-11-03", "17:30"), NOW)).toBe("3 nov")
    expect(relativeDay(at("2026-11-16", "09:00"), NOW)).toBe("16 nov")
  })
  it("builds the meta line and the upcoming label", () => {
    expect(reminderMeta(at("2026-11-03", "17:30"), NOW)).toBe("3 nov · 17:30")
    expect(reminderMeta(at("2026-11-10", "09:05"), NOW)).toBe("amanhã · 09:05")
    expect(upcomingLabel(at("2026-11-11", "10:00"), NOW)).toBe("quarta, 10:00")
  })
})

describe("nextOccurrence", () => {
  it("is null without a rule", () => expect(nextOccurrence(at("2026-11-09", "09:00"), "none", NOW)).toBeNull())
  it("moves one day, one week or one month, keeping the clock time", () => {
    const future = at("2026-11-20", "09:30")
    expect(nextOccurrence(future, "daily", NOW)).toBe(at("2026-11-21", "09:30"))
    expect(nextOccurrence(future, "weekly", NOW)).toBe(at("2026-11-27", "09:30"))
    expect(nextOccurrence(future, "monthly", NOW)).toBe(at("2026-12-20", "09:30"))
  })
  it("skips occurrences that are already in the past", () => {
    const old = at("2026-11-03", "17:30") // overdue by six days
    expect(nextOccurrence(old, "daily", NOW)).toBe(at("2026-11-09", "17:30"))
    expect(nextOccurrence(old, "weekly", NOW)).toBe(at("2026-11-10", "17:30"))
    expect(nextOccurrence(old, "monthly", NOW)).toBe(at("2026-12-03", "17:30"))
  })
  it("keeps the 31st on the last day of shorter months", () => {
    const jan31 = at("2027-01-31", "08:00")
    const now = new Date("2027-01-31T20:00:00Z")
    expect(nextOccurrence(jan31, "monthly", now)).toBe(at("2027-02-28", "08:00"))
  })
})

describe("quick options", () => {
  it("builds today, in 1 hour, tomorrow and next week", () => {
    expect(quickOption("today", NOW)).toEqual({ date: "2026-11-09", time: "11:00" })
    expect(quickOption("hour", NOW)).toEqual({ date: "2026-11-09", time: "11:00" })
    expect(quickOption("tomorrow", NOW)).toEqual({ date: "2026-11-10", time: "09:00" })
    expect(quickOption("week", NOW)).toEqual({ date: "2026-11-16", time: "09:00" })
    expect(quickInstant("tomorrow", NOW)).toBe(at("2026-11-10", "09:00"))
  })
  it("never leaves the day for 'today' late at night", () => {
    const late = new Date("2026-11-10T02:30:00Z") // Monday 23:30 SP
    expect(quickOption("today", late)).toEqual({ date: "2026-11-09", time: "23:30" })
  })
})

describe("parseReminderText", () => {
  it("reads a day and a time", () => {
    expect(parseReminderText("Pagar boleto amanhã às 9h", NOW)).toEqual({ title: "Pagar boleto", remindAt: at("2026-11-10", "09:00") })
    expect(parseReminderText("Ligar para o João depois de amanhã 14:30", NOW)).toEqual({ title: "Ligar para o João", remindAt: at("2026-11-11", "14:30") })
    expect(parseReminderText("Reunião sexta às 15h30", NOW)).toEqual({ title: "Reunião", remindAt: at("2026-11-13", "15:30") })
  })
  it("reads weekday names, the same weekday meaning next week", () => {
    expect(parseReminderText("Aula segunda às 8h", NOW).remindAt).toBe(at("2026-11-16", "08:00"))
    expect(parseReminderText("Feira sábado", NOW).remindAt).toBe(at("2026-11-14", "09:00"))
    expect(parseReminderText("Churrasco domingo-feira", NOW).title).toBe("Churrasco")
  })
  it("reads a time alone: today if ahead, otherwise tomorrow", () => {
    expect(parseReminderText("Remédio às 18h", NOW).remindAt).toBe(at("2026-11-09", "18:00"))
    expect(parseReminderText("Remédio às 8h", NOW).remindAt).toBe(at("2026-11-10", "08:00"))
    expect(parseReminderText("Remédio 22:15", NOW)).toEqual({ title: "Remédio", remindAt: at("2026-11-09", "22:15") })
  })
  it("reads hoje with and without a time", () => {
    expect(parseReminderText("Enviar relatório hoje às 17h", NOW)).toEqual({ title: "Enviar relatório", remindAt: at("2026-11-09", "17:00") })
    expect(parseReminderText("Enviar relatório hoje", NOW).remindAt).toBe(at("2026-11-09", "11:00"))
  })
  it("reads relative times", () => {
    expect(parseReminderText("Tirar o bolo em 2 horas", NOW)).toEqual({ title: "Tirar o bolo", remindAt: new Date(NOW.getTime() + 2 * 3_600_000).toISOString() })
    expect(parseReminderText("Beber água em 30 min", NOW).remindAt).toBe(new Date(NOW.getTime() + 30 * 60_000).toISOString())
  })
  it("gives back the whole text when it carries no date or time", () => {
    expect(parseReminderText("Comprar pão", NOW)).toEqual({ title: "Comprar pão", remindAt: null })
    expect(parseReminderText("Pagar 2 boletos", NOW)).toEqual({ title: "Pagar 2 boletos", remindAt: null })
    expect(parseReminderText("Reunião às 25h", NOW).remindAt).toBeNull()
  })
  it("keeps an empty title when only the time was typed", () => {
    expect(parseReminderText("amanhã às 9h", NOW)).toEqual({ title: "", remindAt: at("2026-11-10", "09:00") })
  })
})
