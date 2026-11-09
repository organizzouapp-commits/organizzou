// Pure helpers of the "Lembretes" tab. Every calendar calculation is done in America/Sao_Paulo (the person's timezone), whatever the device says.
import { addDays, addMonths, format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { dayDiff, inTz, toDueIso } from "@/lib/dates"
import { SP_TIMEZONE } from "@/lib/sp-time"

import type { ReminderRow } from "./types"

type Timed = Pick<ReminderRow, "remind_at" | "status">

// ------------------------------------------------------------------ extra fields (localStorage until the migration is applied)

export type RepeatRule = "none" | "daily" | "weekly" | "monthly"
/** Minutes before the reminder time that the notice should arrive (stored only: delivery still happens at the reminder time). */
export type AdvanceMinutes = 0 | 10 | 60 | 1440
export type ReminderMeta = { repeat?: RepeatRule; advance?: AdvanceMinutes }
export type ReminderMetaMap = Record<string, ReminderMeta>

/** Until supabase/migrations/20261110000004_reminder_repeat.sql is applied (prepared, NOT applied) these live in localStorage behind this interface. */
export type ReminderMetaRepo = { load(): ReminderMetaMap; save(map: ReminderMetaMap): void }

const KEY = "organizzou:lembretes-meta"
export const REPEAT_OPTIONS: { value: RepeatRule; label: string }[] = [
  { value: "none", label: "Não repetir" },
  { value: "daily", label: "Todo dia" },
  { value: "weekly", label: "Toda semana" },
  { value: "monthly", label: "Todo mês" },
]
export const ADVANCE_OPTIONS: { value: AdvanceMinutes; label: string }[] = [
  { value: 0, label: "No horário" },
  { value: 10, label: "10 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
]

export const localReminderMetaRepo: ReminderMetaRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown
      if (!parsed || typeof parsed !== "object") return {}
      const out: ReminderMetaMap = {}
      for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!value || typeof value !== "object") continue
        const v = value as Record<string, unknown>
        const repeat = REPEAT_OPTIONS.some((o) => o.value === v.repeat) ? (v.repeat as RepeatRule) : undefined
        const advance = ADVANCE_OPTIONS.some((o) => o.value === v.advance) ? (v.advance as AdvanceMinutes) : undefined
        out[id] = { repeat, advance }
      }
      return out
    } catch {
      return {}
    }
  },
  save(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map))
    } catch {
      // Private mode: the extras just do not survive the visit.
    }
  },
}

// ------------------------------------------------------------------ grouping

export type ReminderGroupId = "overdue" | "today" | "later" | "done"

/** done → Concluídos; a pending reminder whose time has passed → Atrasados; later today → Hoje; any other day → Mais tarde. */
export function reminderGroup(r: Timed, now: Date): ReminderGroupId {
  if (r.status === "done") return "done"
  if (new Date(r.remind_at).getTime() < now.getTime()) return "overdue"
  return dayDiff(r.remind_at, now, SP_TIMEZONE) === 0 ? "today" : "later"
}

/** The four groups, each sorted: overdue and upcoming ones soonest first, completed ones most recent first. */
export function groupReminders<T extends Timed>(rows: T[], now: Date): Record<ReminderGroupId, T[]> {
  const groups: Record<ReminderGroupId, T[]> = { overdue: [], today: [], later: [], done: [] }
  for (const r of rows) groups[reminderGroup(r, now)].push(r)
  const byTime = (a: T, b: T) => a.remind_at.localeCompare(b.remind_at)
  groups.overdue.sort(byTime)
  groups.today.sort(byTime)
  groups.later.sort(byTime)
  groups.done.sort((a, b) => byTime(b, a))
  return groups
}

/** The oldest overdue reminder time (ISO), or null when nothing is overdue. */
export function mostOverdue(rows: Timed[], now: Date): string | null {
  return rows.filter((r) => reminderGroup(r, now) === "overdue").map((r) => r.remind_at).sort()[0] ?? null
}

/** Completed reminders whose time falls in the current week (Monday to Sunday). */
export function doneThisWeek(rows: Timed[], now: Date): number {
  const today = inTz(now, SP_TIMEZONE)
  const monday = addDays(today, -((today.getDay() + 6) % 7))
  return rows.filter((r) => {
    if (r.status !== "done") return false
    const diff = dayDiff(r.remind_at, monday, SP_TIMEZONE)
    return diff >= 0 && diff < 7
  }).length
}

// ------------------------------------------------------------------ labels

const hhmm = (iso: string) => format(inTz(iso, SP_TIMEZONE), "HH:mm")
const shortWeekday = (iso: string) => format(inTz(iso, SP_TIMEZONE), "EEEE", { locale: ptBR }).split("-")[0]

/** "hoje", "amanhã", "ontem", "quarta" (within a week) or "3 nov". */
export function relativeDay(iso: string, now: Date): string {
  const diff = dayDiff(iso, now, SP_TIMEZONE)
  if (diff === 0) return "hoje"
  if (diff === 1) return "amanhã"
  if (diff === -1) return "ontem"
  if (diff > 1 && diff < 7) return shortWeekday(iso)
  return format(inTz(iso, SP_TIMEZONE), "d MMM", { locale: ptBR }).replace(".", "")
}

/** The meta line of a row: "3 nov · 17:30", with relative words near today ("amanhã · 09:00"). */
export function reminderMeta(iso: string, now: Date): string {
  return `${relativeDay(iso, now)} · ${hhmm(iso)}`
}

/** "3 de novembro" (the hero of Atrasados). */
export const longDay = (iso: string) => format(inTz(iso, SP_TIMEZONE), "d 'de' MMMM", { locale: ptBR })

/** "quarta, 10:00" / "amanhã, 10:00" (the chip of Mais tarde). */
export function upcomingLabel(iso: string, now: Date): string {
  return `${relativeDay(iso, now)}, ${hhmm(iso)}`
}

/** "próximo: 15:30" for the Hoje card. */
export const clockLabel = hhmm

// ------------------------------------------------------------------ repeating

/**
 * The next time of a repeating reminder: the same clock time one day, week or month later (the 31st stays on the last day of shorter
 * months), skipping any occurrence that is already in the past, so finishing an old reminder never creates an overdue one. Null for "none".
 */
export function nextOccurrence(iso: string, rule: RepeatRule, now: Date): string | null {
  if (rule === "none") return null
  const start = inTz(iso, SP_TIMEZONE)
  for (let k = 1; k <= 2000; k++) {
    const next = rule === "daily" ? addDays(start, k) : rule === "weekly" ? addDays(start, 7 * k) : addMonths(start, k)
    if (next.getTime() > now.getTime()) return new Date(next.getTime()).toISOString()
  }
  return null
}

// ------------------------------------------------------------------ quick options (dialog and rescheduling)

export type QuickKind = "today" | "hour" | "tomorrow" | "week"
export const QUICK_OPTIONS: { kind: QuickKind; label: string }[] = [
  { kind: "today", label: "Hoje" },
  { kind: "hour", label: "Em 1 hora" },
  { kind: "tomorrow", label: "Amanhã" },
  { kind: "week", label: "Semana que vem" },
]

const pad = (n: number) => String(n).padStart(2, "0")
const dayString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The day ("yyyy-MM-dd") and time ("HH:mm") of a quick option: today at the next round hour (at most 23:30), in an hour, tomorrow or next week at 09:00. */
export function quickOption(kind: QuickKind, now: Date): { date: string; time: string } {
  const local = inTz(now, SP_TIMEZONE)
  if (kind === "hour") {
    const later = addDays(local, 0)
    later.setMinutes(Math.ceil((later.getMinutes() + 60) / 5) * 5, 0, 0)
    return { date: dayString(later), time: `${pad(later.getHours())}:${pad(later.getMinutes())}` }
  }
  if (kind === "today") {
    const hour = local.getHours() + 1
    return { date: dayString(local), time: hour > 23 ? "23:30" : `${pad(hour)}:00` }
  }
  return { date: dayString(addDays(local, kind === "tomorrow" ? 1 : 7)), time: "09:00" }
}

/** The instant of a quick option. */
export function quickInstant(kind: QuickKind, now: Date): string {
  const { date, time } = quickOption(kind, now)
  return toDueIso(date, time, SP_TIMEZONE)
}

// ------------------------------------------------------------------ quick-add text

const WEEKDAY_PATTERN = "(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)(?:-feira)?"
const WEEKDAY_INDEX: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, terça: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, sábado: 6 }

export type ParsedReminder = { title: string; /** ISO instant, or null when the text carries no date or time. */ remindAt: string | null }

/**
 * Reads a short text such as "Pagar boleto amanhã às 9h": the date and time words are taken out and what is left is the title.
 * Understands hoje, amanhã, depois de amanhã, segunda…domingo, "semana que vem", "às 9h", "9:30", "9h30" and "em 2 horas" / "em 30 min".
 * A day without a time is 09:00 (the next round hour for "hoje"); a time without a day is today, or tomorrow when it already passed.
 */
export function parseReminderText(input: string, now: Date): ParsedReminder {
  let rest = ` ${input.trim()} `
  const take = (pattern: RegExp) => {
    const match = rest.match(pattern)
    if (match) rest = rest.replace(pattern, " ")
    return match
  }
  const local = inTz(now, SP_TIMEZONE)

  const relative = take(/\s+em\s+(\d+)\s*(horas?|h|minutos?|min)\b/i)
  let dayOffset: number | null = null
  let time: { h: number; m: number } | null = null
  if (!relative) {
    // "\b" does not see "ã" as a letter, so these two end on a lookahead instead.
    if (take(/\s+depois\s+de\s+amanh[aã](?=[\s,.]|$)/i)) dayOffset = 2
    else if (take(/\s+amanh[aã](?=[\s,.]|$)/i)) dayOffset = 1
    else if (take(/\s+hoje\b/i)) dayOffset = 0
    else if (take(/\s+semana\s+que\s+vem\b/i)) dayOffset = 7
    else {
      const weekday = take(new RegExp(`\\s+${WEEKDAY_PATTERN}\\b`, "i"))
      if (weekday) {
        const target = WEEKDAY_INDEX[weekday[1].toLowerCase()]
        dayOffset = ((target - local.getDay() + 6) % 7) + 1
      }
    }
    const clock = take(/\s+[àa]s?\s+(\d{1,2})(?:[:h](?:\s?(\d{2}))?)?(?:\s*horas?)?\b/i) ?? take(/\s+(\d{1,2})(?:h\s?(\d{2})?|:(\d{2}))\b/i)
    if (clock) {
      const h = Number(clock[1])
      const m = Number(clock[2] ?? clock[3] ?? 0)
      if (h <= 23 && m <= 59) time = { h, m }
      else rest = ` ${input.trim()} `
    }
  }

  const title = rest
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:para|de|em|às|as|no|na|a)\s+/i, "")
    .replace(/(?:\s+(?:para|de|em|às|as|no|na|a|e))+$/i, "")
    .trim()

  if (relative) {
    const amount = Number(relative[1])
    const minutes = /^h/i.test(relative[2]) ? amount * 60 : amount
    const at = new Date(Math.ceil((now.getTime() + minutes * 60_000) / 60_000) * 60_000)
    return { title, remindAt: at.toISOString() }
  }
  if (dayOffset === null && time === null) return { title: input.trim(), remindAt: null }

  const clockOf = (t: { h: number; m: number }) => `${pad(t.h)}:${pad(t.m)}`
  let day: string
  let at: string
  if (dayOffset !== null) {
    day = dayString(addDays(local, dayOffset))
    at = time ? clockOf(time) : dayOffset === 0 ? quickOption("today", now).time : "09:00"
  } else {
    const t = time as { h: number; m: number }
    const today = toDueIso(dayString(local), clockOf(t), SP_TIMEZONE)
    day = new Date(today).getTime() > now.getTime() ? dayString(local) : dayString(addDays(local, 1))
    at = clockOf(t)
  }
  return { title, remindAt: toDueIso(day, at, SP_TIMEZONE) }
}
