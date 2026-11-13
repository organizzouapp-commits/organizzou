// Which notifications are due right now, apart from the database and from web push. The scheduled job feeds it one person's data and sends
// what comes out; because every notification has a stable key (event + target + moment) the job can run as often as it likes without ever
// sending the same one twice. Pure: dates are computed in the person's own time zone, quiet hours defer instead of dropping.
import { TZDate } from "@date-fns/tz"

import type { EventKey, NotificationPrefs, QuietHours } from "@/features/settings/notification-prefs"

export type PlannerEvent = EventKey | "reminders"

export type Planned = {
  event: PlannerEvent
  targetId: string
  /** The moment it was meant for (ISO): together with event and target it is the idempotency key. */
  bucket: string
  /** When it goes out: the planned moment, or the end of the quiet hours when that falls inside them. */
  at: Date
  title: string
  body: string
  url: string
  tag: string
}

export type PlannerData = {
  reminders: { id: string; title: string; remind_at: string; status: string }[]
  events: { id: string; title: string; starts_at: string; all_day: boolean; rrule: string | null; reminder_offsets: number[] }[]
  tasks: { id: string; title: string; due_at: string | null; completed_at: string | null }[]
  bills: { id: string; name: string; amount_cents: number; due_day: number; last_paid_month: string | null; active: boolean }[]
  pendingHabits: number
  dueCards: number
  todayTasks: number
  todayEvents: number
}

export const EMPTY_PLANNER_DATA: PlannerData = { reminders: [], events: [], tasks: [], bills: [], pendingHabits: 0, dueCards: 0, todayTasks: 0, todayEvents: 0 }

const MIN = 60_000
const pad = (n: number) => String(n).padStart(2, "0")

/** "yyyy-MM-dd" of an instant in a time zone. */
export function localDay(at: Date, timeZone: string): string {
  const t = new TZDate(at.getTime(), timeZone)
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

/** The instant of "HH:mm" on a local day ("yyyy-MM-dd") in a time zone. */
export function atLocal(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number)
  const [h, min] = time.split(":").map(Number)
  return new Date(new TZDate(y, m - 1, d, h, min, 0, timeZone).getTime())
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

const minutesOfDay = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** True when the local time of `at` falls inside the quiet hours (which may cross midnight). */
export function inQuiet(at: Date, quiet: QuietHours, timeZone: string): boolean {
  if (!quiet.enabled || quiet.from === quiet.to) return false
  const t = new TZDate(at.getTime(), timeZone)
  const now = t.getHours() * 60 + t.getMinutes()
  const from = minutesOfDay(quiet.from)
  const to = minutesOfDay(quiet.to)
  return from < to ? now >= from && now < to : now >= from || now < to
}

/** Inside the quiet hours a notification waits for their end (it is deferred, never dropped); outside them it keeps its moment. */
export function deferQuiet(at: Date, quiet: QuietHours, timeZone: string): Date {
  if (!inQuiet(at, quiet, timeZone)) return at
  const day = localDay(at, timeZone)
  const t = new TZDate(at.getTime(), timeZone)
  const afterMidnightStart = minutesOfDay(quiet.from) > minutesOfDay(quiet.to) && t.getHours() * 60 + t.getMinutes() >= minutesOfDay(quiet.from)
  return atLocal(afterMidnightStart ? addDays(day, 1) : day, quiet.to, timeZone)
}

const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()

const clampDay = (month: string, day: number) => Math.min(day, new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate())

/** Every notification that could go out around `now` for one person, with its moment already moved out of the quiet hours. */
export function planNotifications({ now, timeZone, prefs, data }: { now: Date; timeZone: string; prefs: NotificationPrefs; data: PlannerData }): Planned[] {
  const today = localDay(now, timeZone)
  const month = today.slice(0, 7)
  const out: Planned[] = []
  const on = (event: EventKey) => prefs.events[event]?.app === true
  const add = (event: PlannerEvent, targetId: string, at: Date, title: string, body: string, url: string) => {
    out.push({ event, targetId, bucket: at.toISOString(), at: deferQuiet(at, prefs.quiet, timeZone), title, body, url, tag: `${event}:${targetId}` })
  }

  // Reminders were created on purpose, with push as their channel: they always go out (still deferred out of the quiet hours).
  for (const r of data.reminders) if (r.status === "pending") add("reminders", r.id, new Date(r.remind_at), r.title, "Lembrete", "/dashboard/notas")

  if (on("tasks")) {
    for (const t of data.tasks) {
      if (!t.due_at || t.completed_at) continue
      const due = new Date(t.due_at)
      add("tasks", t.id + ":day", atLocal(localDay(due, timeZone), "08:00", timeZone), t.title, "Vence hoje", "/dashboard/tarefas")
      const local = new TZDate(due.getTime(), timeZone)
      if (local.getHours() !== 0 || local.getMinutes() !== 0) add("tasks", t.id + ":hour", new Date(due.getTime() - 60 * MIN), t.title, "Vence em 1 hora", "/dashboard/tarefas")
    }
  }

  if (on("agenda")) {
    for (const e of data.events) {
      // Repeating events are not expanded here yet: only single events remind.
      if (e.rrule) continue
      const start = new Date(e.starts_at)
      for (const offset of e.reminder_offsets) {
        const at = e.all_day ? atLocal(addDays(localDay(start, timeZone), offset >= 1440 ? -Math.floor(offset / 1440) : 0), "08:00", timeZone) : new Date(start.getTime() - offset * MIN)
        add("agenda", `${e.id}:${offset}`, at, e.title, offset === 0 ? "Começa agora" : offset < 60 ? `Começa em ${offset} min` : `Começa em ${Math.round(offset / 60)} h`, "/dashboard/agenda")
      }
    }
  }

  if (on("bills")) {
    for (const b of data.bills) {
      if (!b.active || (b.last_paid_month && b.last_paid_month >= month)) continue
      const due = `${month}-${pad(clampDay(month, b.due_day))}`
      add("bills", `${b.id}:${month}:d3`, atLocal(addDays(due, -3), "08:00", timeZone), b.name, "Vence em 3 dias", "/dashboard/financas")
      add("bills", `${b.id}:${month}:d0`, atLocal(due, "08:00", timeZone), b.name, "Vence hoje", "/dashboard/financas")
    }
  }

  if (on("habits") && data.pendingHabits > 0) add("habits", today, atLocal(today, "18:00", timeZone), "Hábitos do dia", `Faltam ${data.pendingHabits} ${data.pendingHabits === 1 ? "hábito" : "hábitos"} hoje.`, "/dashboard/rotina")

  if (on("study") && data.dueCards > 0) add("study", today, atLocal(today, "19:00", timeZone), "Hora de revisar", `${data.dueCards} ${data.dueCards === 1 ? "cartão espera" : "cartões esperam"} por você.`, "/dashboard/estudos")

  if (on("summary")) {
    const parts = [data.todayTasks > 0 ? `${data.todayTasks} ${data.todayTasks === 1 ? "tarefa" : "tarefas"}` : null, data.todayEvents > 0 ? `${data.todayEvents} ${data.todayEvents === 1 ? "compromisso" : "compromissos"}` : null].filter(Boolean)
    add("summary", `${today}:morning`, atLocal(today, "07:30", timeZone), "Bom dia! Seu dia", parts.length > 0 ? `Hoje: ${parts.join(" e ")}.` : "Nada marcado para hoje.", "/dashboard")
    if (weekday(today) === 0) add("summary", `${today}:week`, atLocal(today, "19:00", timeZone), "Revisão da semana", "Veja como foi a sua semana e planeje a próxima.", "/dashboard")
  }
  return out
}

/** What goes out in this run: planned for the last `windowMs` (the job's interval plus a margin). Earlier moments were this job's earlier runs. */
export function dueNow(planned: Planned[], now: Date, windowMs: number): Planned[] {
  return planned.filter((p) => p.at.getTime() <= now.getTime() && now.getTime() - p.at.getTime() < windowMs)
}

/** The idempotency key stored in notification_log. */
export const logKey = (p: Planned) => ({ event: p.event, target_id: p.targetId, bucket: p.bucket })
