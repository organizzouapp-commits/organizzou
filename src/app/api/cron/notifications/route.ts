import type { SupabaseClient } from "@supabase/supabase-js"
import { timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

import { dueNow, EMPTY_PLANNER_DATA, localDay, logKey, planNotifications, type PlannerData } from "@/features/notifications/planner"
import { defaultPrefs, parseNotificationPrefs } from "@/features/settings/notification-prefs"
import { createSecretClient, secretKeyConfigured } from "@/lib/admin/secret"
import { pushConfigured, sendToUser } from "@/lib/push/send"

// The scheduled dispatcher (Vercel Cron, see vercel.json). It runs every few minutes, works out which notifications are due for each person who
// has a device subscribed, and sends them. Every notification is first written to notification_log (a unique row per person + event + target
// + moment), so a re-run, an overlap or a retry can never send the same one twice. It reads other people's rows with the secret key, only to
// notify them, filtered by user_id; the call itself needs CRON_SECRET.

/** Longer than the job's interval, so a slow or skipped run does not lose a notification; the log prevents repeats. */
const WINDOW_MS = 12 * 60 * 1000
const MAX_USERS = 300

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const wanted = Buffer.from(`Bearer ${secret}`)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

async function loadData(db: SupabaseClient, userId: string, now: Date, today: string): Promise<PlannerData> {
  const from = new Date(now.getTime() - 36 * 3_600_000).toISOString()
  const to = new Date(now.getTime() + 48 * 3_600_000).toISOString()
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  const [reminders, events, tasks, bills, habits, logs, cards] = await Promise.all([
    db.from("reminders").select("id, title, remind_at, status").eq("user_id", userId).eq("status", "pending").gte("remind_at", from).lte("remind_at", to),
    db.from("events").select("id, title, starts_at, all_day, rrule, reminder_offsets").eq("user_id", userId).gte("starts_at", from).lte("starts_at", to),
    db.from("tasks").select("id, title, due_at, completed_at").eq("user_id", userId).is("completed_at", null).eq("archived", false).gte("due_at", from).lte("due_at", to),
    db.from("finance_bills").select("id, name, amount_cents, due_day, last_paid_month, active").eq("user_id", userId).eq("active", true),
    db.from("habits").select("id, weekdays, paused").eq("user_id", userId).eq("paused", false),
    db.from("habit_logs").select("habit_id").eq("user_id", userId).eq("log_date", today),
    db.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId).lte("due_on", today),
  ])
  const logged = new Set(((logs.data ?? []) as { habit_id: string }[]).map((l) => l.habit_id))
  const pendingHabits = ((habits.data ?? []) as { id: string; weekdays: number[] }[]).filter((h) => (h.weekdays ?? []).includes(weekday) && !logged.has(h.id)).length
  const taskRows = (tasks.data ?? []) as PlannerData["tasks"]
  const eventRows = (events.data ?? []) as PlannerData["events"]
  return {
    ...EMPTY_PLANNER_DATA,
    reminders: (reminders.data ?? []) as PlannerData["reminders"],
    events: eventRows,
    tasks: taskRows,
    bills: (bills.data ?? []) as PlannerData["bills"],
    pendingHabits,
    dueCards: cards.count ?? 0,
    todayTasks: taskRows.filter((t) => t.due_at && localDay(new Date(t.due_at), "America/Sao_Paulo") === today).length,
    todayEvents: eventRows.filter((e) => localDay(new Date(e.starts_at), "America/Sao_Paulo") === today).length,
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!secretKeyConfigured() || !pushConfigured()) return NextResponse.json({ ok: false, skipped: "push is not configured on this server" }, { status: 200 })

  const db = createSecretClient()
  const now = new Date()
  const { data: subscribed } = await db.from("push_subscriptions").select("user_id").limit(5000)
  const users = [...new Set(((subscribed ?? []) as { user_id: string }[]).map((s) => s.user_id))].slice(0, MAX_USERS)

  let sent = 0
  let skipped = 0
  for (const userId of users) {
    try {
      const [{ data: profile }, { data: prefRow }] = await Promise.all([
        db.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
        db.from("notification_preferences").select("settings").eq("user_id", userId).maybeSingle(),
      ])
      const timeZone = (profile as { timezone?: string } | null)?.timezone || "America/Sao_Paulo"
      const settings = (prefRow as { settings?: Record<string, unknown> } | null)?.settings
      const prefs = settings && Object.keys(settings).length > 0 ? parseNotificationPrefs(settings) : defaultPrefs()
      const today = localDay(now, timeZone)
      const planned = dueNow(planNotifications({ now, timeZone, prefs, data: await loadData(db, userId, now, today) }), now, WINDOW_MS)
      for (const item of planned) {
        // Claim it first: only the run that inserts the row sends the notification.
        const claim = await db.from("notification_log").insert({ user_id: userId, ...logKey(item) })
        if (claim.error) {
          skipped += 1
          continue
        }
        const result = await sendToUser(db, userId, { title: item.title, body: item.body, url: item.url, tag: item.tag })
        sent += result.sent
      }
    } catch {
      // One person's problem never stops the others; nothing about their data is logged.
      skipped += 1
    }
  }
  return NextResponse.json({ ok: true, users: users.length, sent, skipped })
}
