import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"

import { dispatch, verdictOf, WINDOW_MS } from "./dispatch"
import { atLocal, explainCandidates, EMPTY_PLANNER_DATA } from "./planner"
import { defaultPrefs } from "@/features/settings/notification-prefs"
import type { PushResult } from "@/lib/push/send"

// ---------------------------------------------------------------- a small in-memory database with the query builder the dispatcher uses
type Row = Record<string, unknown>
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  const table = (name: string) => (tables[name] ??= [])
  const builder = (name: string) => {
    const filters: ((r: Row) => boolean)[] = []
    let head = false
    const rows = () => table(name).filter((r) => filters.every((f) => f(r)))
    const q: Record<string, unknown> = {
      select: (_columns?: string, options?: { head?: boolean }) => {
        head = Boolean(options?.head)
        return q
      },
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      gte: (c: string, v: string) => (filters.push((r) => r[c] != null && String(r[c]) >= v), q),
      lte: (c: string, v: string) => (filters.push((r) => r[c] != null && String(r[c]) <= v), q),
      is: (c: string, v: unknown) => (filters.push((r) => (v === null ? r[c] == null : r[c] === v)), q),
      not: (c: string, _op: string, v: unknown) => (filters.push((r) => (v === null ? r[c] != null : r[c] !== v)), q),
      limit: () => q,
      maybeSingle: async () => ({ data: rows()[0] ?? null }),
      then: (resolve: (value: unknown) => void) => resolve(head ? { count: rows().length, data: null } : { data: rows() }),
      insert: async (row: Row) => {
        if (name === "notification_log" && table(name).some((r) => r.user_id === row.user_id && r.event === row.event && r.target_id === row.target_id && r.bucket === row.bucket)) return { error: { code: "23505" } }
        table(name).push({ sent_at: new Date().toISOString(), ...row })
        return { error: null }
      },
      delete: () => {
        const del: Record<string, unknown> = {
          eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), del),
          match: async (m: Row) => {
            tables[name] = table(name).filter((r) => !(filters.every((f) => f(r)) && Object.entries(m).every(([k, v]) => r[k] === v)))
            return { error: null }
          },
        }
        return del
      },
    }
    return q
  }
  return { from: builder } as unknown as SupabaseClient
}

const ok = (sent = 1): PushResult => ({ sent, failed: 0, removed: 0, devices: sent, failures: {} })
const noDelivery = (): PushResult => ({ sent: 0, failed: 1, removed: 0, devices: 1, failures: { vapid_rejected: 1 } })

const TZ = "America/Sao_Paulo"
const day = "2026-11-17"
/** "Teste notificação" 09:37-10:00 and "testes noti 2" 10:13-10:30, both with "10 minutos antes", as in the report. */
const events = (offsets = [10]) => [
  { id: "e1", user_id: "u1", title: "Teste notificação", starts_at: atLocal(day, "09:37", TZ).toISOString(), ends_at: atLocal(day, "10:00", TZ).toISOString(), all_day: false, rrule: null, reminder_offsets: offsets },
  { id: "e2", user_id: "u1", title: "testes noti 2", starts_at: atLocal(day, "10:13", TZ).toISOString(), ends_at: atLocal(day, "10:30", TZ).toISOString(), all_day: false, rrule: null, reminder_offsets: offsets },
]
const world = (extra: Record<string, Row[]> = {}) => ({
  push_subscriptions: [{ user_id: "u1" }],
  profiles: [{ id: "u1", timezone: TZ }],
  events: events(),
  notification_log: [] as Row[],
  ...extra,
})
const at = (time: string) => atLocal(day, time, TZ)
const run = (tables: Record<string, Row[]>, now: Date, send: (db: SupabaseClient, userId: string, payload: { tag?: string }) => Promise<PushResult> = async () => ok(), dryRun = false) => dispatch({ db: fakeDb(tables), now, dryRun, send: send as never })

describe("event reminders, from the events table, in the right 5-minute run", () => {
  it("an event with a 10 minute reminder is sent by the run that covers its moment (09:27 for 09:37), once", async () => {
    const tables = world()
    const sent: string[] = []
    const send = async (_db: SupabaseClient, _user: string, payload: { tag?: string }) => (sent.push(payload.tag ?? ""), ok())

    expect((await run(tables, at("09:25"), send)).sent).toBe(0) // not yet
    const first = await run(tables, at("09:30"), send)
    expect(first).toMatchObject({ users: 1, due: 1, sent: 1, kinds: { agenda: { send: 1, sent: 1 } } })
    expect(sent).toEqual(["agenda:e1:10"])

    // The next run (09:35) must not send it again: the log has it.
    const again = await run(tables, at("09:35"), send)
    expect(again.sent).toBe(0)
    expect(again.kinds.agenda.already_sent).toBe(1)
    expect(sent).toHaveLength(1)

    // The second event is picked by its own run (10:03 for 10:13).
    expect((await run(tables, at("10:05"), send)).sent).toBe(1)
    expect(sent).toEqual(["agenda:e1:10", "agenda:e2:10"])
  })

  it("converts from the person's zone: the same events are not due at 09:30 UTC (06:30 in São Paulo)", async () => {
    const result = await run(world(), new Date(`${day}T09:30:00Z`))
    expect(result.due).toBe(0)
  })

  it("a reminder created late (after its moment, before the event starts) still goes out once", async () => {
    // 30 minutes before, but only seen 23 minutes after the moment: past the 12 minute window, before the 09:37 start.
    const tables = world({ events: events([30]) })
    const late = await run(tables, at("09:30"))
    expect(late.sent).toBe(1)
    expect((await run(tables, at("09:32"))).sent).toBe(0)
    // After the event started it is no longer sent.
    const after = await run(world({ events: events([30]) }), at("09:38"))
    expect(after.sent).toBe(0)
    expect(after.kinds.agenda.outside_window).toBeGreaterThan(0)
  })

  it("quiet hours defer, never drop, and 10:03 is not inside 22:00-07:00", async () => {
    const early = [{ id: "e3", user_id: "u1", title: "Cedo", starts_at: at("06:50").toISOString(), ends_at: at("07:30").toISOString(), all_day: false, rrule: null, reminder_offsets: [10] }]
    const tables = world({ events: early })
    const quiet = await run(tables, at("06:45"))
    expect(quiet.sent).toBe(0)
    expect(quiet.kinds.agenda.quiet_hours).toBe(1)
    const after = await run(tables, at("07:00"))
    expect(after.sent).toBe(1)
    // and the ordinary 10:03 reminder is not treated as quiet
    expect((await run(world(), at("10:05"))).kinds.agenda.quiet_hours).toBe(0)
  })

  it("a repeating event reminds on each occurrence, found by its rule even though it started long ago", async () => {
    const daily = [{ id: "r1", user_id: "u1", title: "Daily", starts_at: new Date("2026-10-01T12:37:00Z").toISOString(), ends_at: new Date("2026-10-01T13:00:00Z").toISOString(), all_day: false, rrule: "FREQ=DAILY", reminder_offsets: [10] }]
    const tables = world({ events: daily })
    const result = await run(tables, at("09:30"))
    expect(result.sent).toBe(1)
    expect(tables.notification_log).toHaveLength(1)
    // tomorrow's occurrence is a different moment, so it is a different notification
    expect((await run(tables, atLocal("2026-11-18", "09:30", TZ))).sent).toBe(1)
  })

  it("an all-day event reminds at 08:00 of its day", async () => {
    const holiday = [{ id: "a1", user_id: "u1", title: "Feriado", starts_at: at("00:00").toISOString(), ends_at: at("23:59").toISOString(), all_day: true, rrule: null, reminder_offsets: [10] }]
    expect((await run(world({ events: holiday }), at("08:02"))).kinds.agenda.sent).toBe(1)
    expect((await run(world({ events: holiday }), at("07:30"))).kinds.agenda.sent).toBe(0)
  })
})

describe("idempotency and failures", () => {
  it("a delivery that reached no device releases the claim, so the next run tries again", async () => {
    const tables = world()
    const failing = await run(tables, at("09:30"), async () => noDelivery())
    expect(failing).toMatchObject({ sent: 0, failed: 1, failures: { vapid_rejected: 1 } })
    expect(tables.notification_log).toHaveLength(0)
    const retry = await run(tables, at("09:35"))
    expect(retry.sent).toBe(1)
    expect(tables.notification_log).toHaveLength(1)
  })

  it("a row already claimed by another run is not sent again", async () => {
    const tables = world()
    await run(tables, at("09:30"))
    let called = 0
    await run(tables, at("09:31"), async () => (called++, ok()))
    expect(called).toBe(0)
  })
})

describe("dry run: nothing is sent, every candidate has a reason", () => {
  it("lists what would be sent and why the rest is skipped, by kind and id only", async () => {
    let called = 0
    const tables = world({
      push_subscriptions: [{ user_id: "u1" }],
      notification_preferences: [{ user_id: "u1", settings: { events: { tasks: { app: false, email: false } }, quiet: { enabled: true, from: "22:00", to: "07:00" } } }],
      tasks: [{ id: "t1", user_id: "u1", title: "Entrega", due_at: at("18:00").toISOString(), completed_at: null, archived: false }],
      notification_log: [{ user_id: "u1", event: "agenda", target_id: "e2:10", bucket: at("10:03").toISOString(), sent_at: at("10:04").toISOString() }],
    })
    const report = await run(tables, at("10:05"), async () => (called++, ok()), true)
    expect(called).toBe(0)
    expect(tables.notification_log).toHaveLength(1)
    expect(report.dryRun).toBe(true)
    expect(report.noSource).toEqual(["workout", "meals"])
    expect(report.kinds.agenda).toMatchObject({ candidates: 2, send: 0, already_sent: 1, outside_window: 1 })
    expect(report.kinds.tasks.pref_off).toBeGreaterThan(0)
    expect(report.candidates).toContainEqual({ kind: "agenda", id: "e2:10", verdict: "already_sent" })
    // ids and reasons only: no titles
    expect(JSON.stringify(report)).not.toMatch(/Entrega|Teste notificação/)
  })

  it("someone with an event but no device is reported as no_subscription (dry run only)", async () => {
    const tables = world({ push_subscriptions: [], events: events().map((e) => ({ ...e, user_id: "u9" })), profiles: [{ id: "u9", timezone: TZ }] })
    const report = await run(tables, at("09:30"), undefined, true)
    expect(report.kinds.agenda.no_subscription).toBe(1)
    expect(report.sent).toBe(0)
  })
})

describe("verdictOf and the summary kinds", () => {
  it("returns the reason codes in a stable order of precedence", () => {
    const planned = explainCandidates({ now: at("09:30"), timeZone: TZ, prefs: defaultPrefs(), data: { ...EMPTY_PLANNER_DATA, events: [{ id: "e", title: "x", starts_at: at("09:37").toISOString(), all_day: false, rrule: null, reminder_offsets: [10] }] } }).filter((p) => p.event === "agenda")
    expect(planned).toHaveLength(1)
    expect(verdictOf(planned[0], at("09:30"), new Set(), true)).toBe("send")
    expect(verdictOf(planned[0], at("09:30"), new Set(), false)).toBe("no_subscription")
    expect(verdictOf(planned[0], at("09:30"), new Set([`agenda|e:10|${planned[0].bucket}`]), true)).toBe("already_sent")
    expect(verdictOf({ ...planned[0], enabled: false }, at("09:30"), new Set(), true)).toBe("pref_off")
    expect(verdictOf(planned[0], at("09:00"), new Set(), true)).toBe("outside_window")
    expect(WINDOW_MS).toBeGreaterThan(5 * 60_000)
  })
})
