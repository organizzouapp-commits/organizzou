import { TZDate } from "@date-fns/tz"

import type { AgendaItem, EventRow } from "./types"

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]

type Rule = { freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"; byDay: number[] }

export function parseRule(rrule: string | null): Rule | null {
  if (!rrule) return null
  const parts = Object.fromEntries(rrule.split(";").map((part) => part.split("=") as [string, string]))
  const freq = parts.FREQ
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null
  const byDay = (parts.BYDAY ?? "")
    .split(",")
    .map((code) => WEEKDAY_CODES.indexOf(code))
    .filter((index) => index >= 0)
  return { freq, byDay }
}

export const REPEAT_OPTIONS = [
  { value: "none", label: "Não repetir", rrule: null },
  { value: "daily", label: "Todos os dias", rrule: "FREQ=DAILY" },
  { value: "weekly", label: "Toda semana", rrule: "FREQ=WEEKLY" },
  { value: "monthly", label: "Todo mês", rrule: "FREQ=MONTHLY" },
  { value: "yearly", label: "Todo ano", rrule: "FREQ=YEARLY" },
] as const

export function repeatLabel(rrule: string | null) {
  const rule = parseRule(rrule)
  if (!rule) return "Não se repete"
  if (rule.freq === "WEEKLY" && rule.byDay.length > 1) return "Em dias fixos da semana"
  return REPEAT_OPTIONS.find((o) => o.rrule === `FREQ=${rule.freq}`)?.label ?? "Repete"
}

function startOfDayIn(date: TZDate, timeZone: string) {
  return new TZDate(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, timeZone)
}

/**
 * Occurrences of an event that start inside [from, to). Wall-clock time is preserved in the
 * given timezone, so a 10:00 meeting stays at 10:00 across daylight-saving changes.
 */
export function expandEvent(event: EventRow, from: Date, to: Date, timeZone: string): AgendaItem[] {
  const anchor = new TZDate(new Date(event.starts_at), timeZone)
  const duration = new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()
  const rule = parseRule(event.rrule)
  const items: AgendaItem[] = []

  const push = (start: Date) => {
    items.push({
      key: `${event.id}:${start.toISOString()}`,
      kind: "event",
      id: event.id,
      title: event.title,
      start,
      end: new Date(start.getTime() + duration),
      allDay: event.all_day,
      swatch: event.swatch,
      detail: event.location ?? event.category ?? undefined,
      editable: true,
    })
  }

  if (!rule) {
    const start = new Date(event.starts_at)
    if (start >= from && start < to) push(start)
    return items
  }

  const firstDay = startOfDayIn(anchor, timeZone).getTime()
  let day = startOfDayIn(new TZDate(from, timeZone), timeZone)
  for (let guard = 0; guard < 400 && day.getTime() < to.getTime(); guard += 1) {
    const start = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), anchor.getHours(), anchor.getMinutes(), 0, timeZone)
    const weekday = start.getDay()
    let matches = false
    switch (rule.freq) {
      case "DAILY":
        matches = true
        break
      case "WEEKLY":
        matches = rule.byDay.length > 0 ? rule.byDay.includes(weekday) : weekday === anchor.getDay()
        break
      case "MONTHLY":
        matches = start.getDate() === anchor.getDate()
        break
      case "YEARLY":
        matches = start.getDate() === anchor.getDate() && start.getMonth() === anchor.getMonth()
        break
    }
    if (matches && day.getTime() >= firstDay) {
      const instant = new Date(start.getTime())
      if (instant >= from && instant < to) push(instant)
    }
    day = new TZDate(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, timeZone)
  }
  return items
}

export type PositionedItem = { item: AgendaItem; column: number; columns: number }

/** Side-by-side lanes for overlapping timed items in a single day. */
export function layoutDay(items: AgendaItem[]): PositionedItem[] {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime())
  const result: PositionedItem[] = []
  let group: PositionedItem[] = []
  let groupEnd = 0

  const flush = () => {
    const columns = Math.max(1, ...group.map((g) => g.column + 1))
    for (const entry of group) result.push({ ...entry, columns })
    group = []
  }

  for (const item of sorted) {
    if (group.length > 0 && item.start.getTime() >= groupEnd) flush()
    const used = new Set(group.filter((g) => g.item.end.getTime() > item.start.getTime()).map((g) => g.column))
    let column = 0
    while (used.has(column)) column += 1
    group.push({ item, column, columns: 1 })
    groupEnd = Math.max(groupEnd, item.end.getTime())
  }
  flush()
  return result
}
