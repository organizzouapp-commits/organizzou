import { TZDate } from "@date-fns/tz"
import { differenceInCalendarDays, format } from "date-fns"
import { ptBR } from "date-fns/locale"

export const DEFAULT_TIMEZONE = "America/Sao_Paulo"

type DueFields = { due_at: string | null; due_has_time: boolean }

export function inTz(date: Date | string | number, timeZone: string) {
  return new TZDate(new Date(date), timeZone)
}

/** Whole calendar days from `now` to `date` in the given timezone (0 = same day). */
export function dayDiff(date: Date | string, now: Date, timeZone: string) {
  return differenceInCalendarDays(inTz(date, timeZone), inTz(now, timeZone))
}

/** "yyyy-MM-dd" of an instant as seen in the timezone. */
export function dayKey(date: Date | string, timeZone: string) {
  return format(inTz(date, timeZone), "yyyy-MM-dd")
}

export function isOverdue(task: DueFields, now: Date, timeZone: string) {
  if (!task.due_at) return false
  if (task.due_has_time) return new Date(task.due_at).getTime() < now.getTime()
  return dayDiff(task.due_at, now, timeZone) < 0
}

export function isDueToday(task: DueFields, now: Date, timeZone: string) {
  return Boolean(task.due_at) && dayDiff(task.due_at as string, now, timeZone) === 0
}

/** Short pt-BR label: "Hoje", "Amanhã", "seg", "12 out", plus " · 17:00" when the task has a time. */
export function formatDue(task: DueFields, now: Date, timeZone: string) {
  if (!task.due_at) return ""
  const due = inTz(task.due_at, timeZone)
  const diff = dayDiff(task.due_at, now, timeZone)

  let label: string
  if (diff === 0) label = "Hoje"
  else if (diff === 1) label = "Amanhã"
  else if (diff === -1) label = "Ontem"
  else if (diff > 1 && diff < 7) label = format(due, "EEE", { locale: ptBR })
  else if (due.getFullYear() === inTz(now, timeZone).getFullYear())
    label = format(due, "d MMM", { locale: ptBR })
  else label = format(due, "d MMM yyyy", { locale: ptBR })

  return task.due_has_time ? `${label} · ${format(due, "HH:mm")}` : label
}

/** Builds the stored instant from a calendar day and optional "HH:mm". Date-only uses noon to avoid DST edges. */
export function toDueIso(day: string, time: string | null, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number)
  const [hours, minutes] = (time ?? "12:00").split(":").map(Number)
  return new Date(new TZDate(year, month - 1, date, hours, minutes, 0, timeZone).getTime()).toISOString()
}

export function splitDue(dueAt: string, hasTime: boolean, timeZone: string) {
  const due = inTz(dueAt, timeZone)
  return { day: format(due, "yyyy-MM-dd"), time: hasTime ? format(due, "HH:mm") : null }
}

export function greeting(now: Date, timeZone: string) {
  const hour = inTz(now, timeZone).getHours()
  if (hour < 5) return "Boa madrugada"
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}
