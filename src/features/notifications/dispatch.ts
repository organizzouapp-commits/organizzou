// The scheduled dispatcher, apart from the HTTP route: loads what each person has, works out what is due, sends it, and explains every
// candidate it did NOT send. The route (src/app/api/cron/notifications) only checks the secret and calls this. Sending is injected, so the whole
// flow is tested with a fake database and no web push.
import type { SupabaseClient } from "@supabase/supabase-js"

import { getUserEntitlements } from "@/lib/plan-server"
import { explainCandidates, EMPTY_PLANNER_DATA, localDay, logKey, phaseOf, type Planned, type PlannerData } from "@/features/notifications/planner"
import { defaultPrefs, parseNotificationPrefs } from "@/features/settings/notification-prefs"
import type { PushPayload, PushResult } from "@/lib/push/send"

/** Longer than the job's interval (5 minutes), so a slow or skipped run does not lose a notification; the log prevents repeats. */
export const WINDOW_MS = 12 * 60 * 1000
export const MAX_USERS = 300

/** Notifications about something at a set time stay on screen until clicked. */
export const STICKY_EVENTS = new Set<string>(["reminders", "agenda", "tasks", "workout"])

/** Kinds listed in Avisos that the server has nothing to read for: there is no time source (no workout time, no meal times), so they never go out. */
export const NO_SOURCE_KINDS = ["workout", "meals"] as const

export type Reason = "pref_off" | "quiet_hours" | "outside_window" | "already_sent" | "no_subscription" | "plan_locked"
export type Verdict = "send" | Reason

export const keyOf = (p: Pick<Planned, "event" | "targetId" | "bucket">) => `${p.event}|${p.targetId}|${p.bucket}`

/** Why a candidate is (not) sent in this run. Pure. */
export function verdictOf(p: Planned, now: Date, sentKeys: Set<string>, hasSubscription: boolean): Verdict {
  const phase = phaseOf(p, now, WINDOW_MS)
  if (phase === "pref_off") return "pref_off"
  if (phase === "quiet_hours") return "quiet_hours"
  if (phase === "future" || phase === "expired") return "outside_window"
  if (sentKeys.has(keyOf(p))) return "already_sent"
  if (!hasSubscription) return "no_subscription"
  return "send"
}

export type KindSummary = { candidates: number; send: number; sent: number; failed: number } & Record<Reason, number>
const blank = (): KindSummary => ({ candidates: 0, send: 0, sent: 0, failed: 0, pref_off: 0, quiet_hours: 0, outside_window: 0, already_sent: 0, no_subscription: 0, plan_locked: 0 })

export type DispatchReport = {
  ok: true
  dryRun: boolean
  users: number
  /** Notifications due in this run (what is sent, or what WOULD be sent in a dry run). */
  due: number
  /** Devices the push service accepted the notification for. */
  sent: number
  failed: number
  /** Due but not sent: already claimed by another run, or an error for that person. */
  skipped: number
  failures: Record<string, number>
  /** The summary per kind (agenda, tasks, habits, bills, study, summary, reminders...). */
  kinds: Record<string, KindSummary>
  /** Kinds listed in Avisos without a server source. */
  noSource: string[]
  /** Dry run only: each candidate by kind and id with its verdict. Ids only, no titles, no personal data. */
  candidates?: { kind: string; id: string; verdict: Verdict }[]
}

type Sender = (db: SupabaseClient, userId: string, payload: PushPayload) => Promise<PushResult>

// ---------------------------------------------------------------- loading what one person has

export async function loadPlannerData(db: SupabaseClient, userId: string, now: Date, today: string): Promise<PlannerData> {
  const from = new Date(now.getTime() - 36 * 3_600_000).toISOString()
  const to = new Date(now.getTime() + 48 * 3_600_000).toISOString()
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  const [reminders, events, repeating, tasks, bills, habits, logs, cards] = await Promise.all([
    db.from("reminders").select("id, title, remind_at, status").eq("user_id", userId).eq("status", "pending").gte("remind_at", from).lte("remind_at", to),
    db.from("events").select("id, title, starts_at, ends_at, all_day, rrule, reminder_offsets").eq("user_id", userId).gte("starts_at", from).lte("starts_at", to),
    // A repeating event started long ago: it is found by its rule, not by its first date.
    db.from("events").select("id, title, starts_at, ends_at, all_day, rrule, reminder_offsets").eq("user_id", userId).not("rrule", "is", null),
    db.from("tasks").select("id, title, due_at, completed_at").eq("user_id", userId).is("completed_at", null).eq("archived", false).gte("due_at", from).lte("due_at", to),
    db.from("finance_bills").select("id, name, amount_cents, due_day, last_paid_month, active").eq("user_id", userId).eq("active", true),
    db.from("habits").select("id, weekdays, paused").eq("user_id", userId).eq("paused", false),
    db.from("habit_logs").select("habit_id").eq("user_id", userId).eq("log_date", today),
    db.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId).lte("due_on", today),
  ])
  const logged = new Set(((logs.data ?? []) as { habit_id: string }[]).map((l) => l.habit_id))
  const pendingHabits = ((habits.data ?? []) as { id: string; weekdays: number[] }[]).filter((h) => (h.weekdays ?? []).includes(weekday) && !logged.has(h.id)).length
  const taskRows = (tasks.data ?? []) as PlannerData["tasks"]
  const eventRows = new Map<string, PlannerData["events"][number]>()
  for (const e of [...((events.data ?? []) as PlannerData["events"]), ...((repeating.data ?? []) as PlannerData["events"])]) eventRows.set(e.id, e)
  const eventList = [...eventRows.values()]
  return {
    ...EMPTY_PLANNER_DATA,
    reminders: (reminders.data ?? []) as PlannerData["reminders"],
    events: eventList,
    tasks: taskRows,
    bills: (bills.data ?? []) as PlannerData["bills"],
    pendingHabits,
    dueCards: cards.count ?? 0,
    todayTasks: taskRows.filter((t) => t.due_at && localDay(new Date(t.due_at), "America/Sao_Paulo") === today).length,
    todayEvents: eventList.filter((e) => !e.rrule && localDay(new Date(e.starts_at), "America/Sao_Paulo") === today).length,
  }
}

/** What was already sent (or claimed) for one person recently, as "kind|target|bucket" keys. */
async function loadSentKeys(db: SupabaseClient, userId: string, now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - 4 * 24 * 3_600_000).toISOString()
  const { data } = await db.from("notification_log").select("event, target_id, bucket").eq("user_id", userId).gte("sent_at", since)
  return new Set(((data ?? []) as { event: string; target_id: string; bucket: string }[]).map((r) => `${r.event}|${r.target_id}|${r.bucket}`))
}

// ---------------------------------------------------------------- the run

export async function dispatch({ db, now, dryRun, send }: { db: SupabaseClient; now: Date; dryRun: boolean; send: Sender }): Promise<DispatchReport> {
  const { data: subscribed } = await db.from("push_subscriptions").select("user_id").limit(5000)
  const withSubscription = new Set(((subscribed ?? []) as { user_id: string }[]).map((s) => s.user_id))
  let userIds = [...withSubscription]
  if (dryRun) {
    // To explain "no_subscription" the dry run also looks at people who have something to be reminded of but no device.
    const from = new Date(now.getTime() - 36 * 3_600_000).toISOString()
    const to = new Date(now.getTime() + 48 * 3_600_000).toISOString()
    const [upcoming, repeating] = await Promise.all([
      db.from("events").select("user_id").gte("starts_at", from).lte("starts_at", to).limit(5000),
      db.from("events").select("user_id").not("rrule", "is", null).limit(5000),
    ])
    for (const row of [...((upcoming.data ?? []) as { user_id: string }[]), ...((repeating.data ?? []) as { user_id: string }[])]) if (!userIds.includes(row.user_id)) userIds.push(row.user_id)
  }
  userIds = userIds.slice(0, MAX_USERS)

  const report: DispatchReport = { ok: true, dryRun, users: userIds.length, due: 0, sent: 0, failed: 0, skipped: 0, failures: {}, kinds: {}, noSource: [...NO_SOURCE_KINDS] }
  if (dryRun) report.candidates = []
  const kind = (name: string) => (report.kinds[name] ??= blank())

  for (const userId of userIds) {
    try {
      const [{ data: profile }, { data: prefRow }] = await Promise.all([
        db.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
        db.from("notification_preferences").select("settings").eq("user_id", userId).maybeSingle(),
      ])
      const timeZone = (profile as { timezone?: string } | null)?.timezone || "America/Sao_Paulo"
      const settings = (prefRow as { settings?: Record<string, unknown> } | null)?.settings
      const prefs = settings && Object.keys(settings).length > 0 ? parseNotificationPrefs(settings) : defaultPrefs()
      const today = localDay(now, timeZone)
      const candidates = explainCandidates({ now, timeZone, prefs, data: await loadPlannerData(db, userId, now, today) })
      const sentKeys = await loadSentKeys(db, userId, now)
      const hasSubscription = withSubscription.has(userId)
      // Free keeps the reminders of tasks and its own reminders; every other kind of notice is Pro (nothing is deleted, it just is not sent).
      const allNotifications = (await getUserEntitlements(db, userId)).canUse("allNotifications")

      for (const item of candidates) {
        const verdict = verdictOf(item, now, sentKeys, hasSubscription)
        const summary = kind(item.event)
        summary.candidates += 1
        if (!allNotifications && item.event !== "tasks" && item.event !== "reminders") {
          summary.plan_locked += 1
          continue
        }
        if (verdict !== "send") {
          summary[verdict] += 1
          // Candidates that merely are not due (far away, or long past) would drown the list: only the ones that matter now are listed.
          if (dryRun && verdict !== "outside_window" && report.candidates!.length < 200) report.candidates!.push({ kind: item.event, id: item.targetId, verdict })
          continue
        }
        summary.send += 1
        report.due += 1
        if (dryRun) {
          if (report.candidates!.length < 200) report.candidates!.push({ kind: item.event, id: item.targetId, verdict })
          continue
        }
        // Claim it first: only the run that inserts the row sends the notification.
        const claim = await db.from("notification_log").insert({ user_id: userId, ...logKey(item) })
        if (claim.error) {
          summary.already_sent += 1
          summary.send -= 1
          report.due -= 1
          report.skipped += 1
          continue
        }
        const result = await send(db, userId, { title: item.title, body: item.body, url: item.url, tag: item.tag, sticky: STICKY_EVENTS.has(item.event) })
        summary.sent += result.sent
        summary.failed += result.failed + result.removed
        report.sent += result.sent
        report.failed += result.failed + result.removed
        for (const [code, count] of Object.entries(result.failures)) report.failures[code] = (report.failures[code] ?? 0) + (count ?? 0)
        // Not delivered anywhere (a push service problem, a device that just expired, no device): release the claim so the next run, still
        // inside the window or the event's grace period, tries again instead of losing the notification.
        if (result.sent === 0) await db.from("notification_log").delete().eq("user_id", userId).match(logKey(item))
      }
    } catch {
      // One person's problem never stops the others; nothing about their data is logged.
      report.skipped += 1
    }
  }
  return report
}
