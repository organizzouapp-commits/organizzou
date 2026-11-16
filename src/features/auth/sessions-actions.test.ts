import { beforeEach, describe, expect, it, vi } from "vitest"

// A tiny in-memory stand-in for the database: user_sessions rows plus the three functions of the migration (register, revoke one, revoke others).
type Row = { id: string; user_id: string; auth_session_id: string; label: string; place: string | null; created_at: string; last_seen_at: string; revoked_at: string | null }
const state = { rows: [] as Row[], uid: "u1", session: "s-phone", tableMissing: false, noDelete: false }

function fakeClient() {
  return {
    auth: { getClaims: async () => ({ data: { claims: { sub: state.uid, session_id: state.session } } }) },
    from: () => {
      let wantUser = ""
      const query = {
        select: () => query,
        eq: (_c: string, v: string) => ((wantUser = v), query),
        is: async () => (state.tableMissing ? { data: null, error: { code: "42P01", message: 'relation "user_sessions" does not exist' } } : { data: state.rows.filter((r) => r.user_id === wantUser && !r.revoked_at), error: null }),
      }
      return query
    },
    rpc: async (name: string, args: Record<string, string>) => {
      if (name === "register_session") {
        const found = state.rows.find((r) => r.user_id === state.uid && r.auth_session_id === args.p_session)
        if (found) found.last_seen_at = "2026-11-16T12:00:00Z"
        else state.rows.push({ id: `row-${state.rows.length + 1}`, user_id: state.uid, auth_session_id: args.p_session, label: args.p_label, place: args.p_place, created_at: "2026-11-16T12:00:00Z", last_seen_at: "2026-11-16T12:00:00Z", revoked_at: null })
        return { data: Boolean(found?.revoked_at), error: null }
      }
      if (state.noDelete && name.startsWith("revoke_")) return { data: null, error: { code: "42501", message: "sessions_delete_not_permitted: the owner of this function cannot delete from auth.sessions" } }
      if (name === "revoke_session") {
        const row = state.rows.find((r) => r.id === args.p_id && r.user_id === state.uid)
        if (!row) return { data: false, error: null }
        row.revoked_at = "2026-11-16T12:05:00Z"
        return { data: true, error: null }
      }
      if (name === "revoke_other_sessions") {
        let n = 0
        for (const r of state.rows) if (r.user_id === state.uid && r.auth_session_id !== args.p_current && !r.revoked_at) ((r.revoked_at = "2026-11-16T12:05:00Z"), n++)
        return { data: n, error: null }
      }
      return { data: null, error: { message: "unknown" } }
    },
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36" }) }))

import { endOtherSessions, endSession, listSessions } from "./sessions-actions"
import { PERMISSION_MESSAGE } from "./sessions-errors"

const register = (session: string, label: string) => fakeClient().rpc("register_session", { p_session: session, p_label: label, p_place: "" })

beforeEach(() => {
  state.rows = []
  state.uid = "u1"
  state.session = "s-phone"
  state.tableMissing = false
  state.noDelete = false
})

describe("sessions list", () => {
  it("shows a second device after it registers, and marks only the current one", async () => {
    await register("s-phone", "Chrome no Android")
    await register("s-pc", "Chrome no Windows")
    const { sessions, status } = await listSessions()
    expect(status).toBe("ok")
    expect(sessions.map((s) => s.label).sort()).toEqual(["Chrome no Android", "Chrome no Windows"])
    expect(sessions.filter((s) => s.current)).toHaveLength(1)
    expect(sessions[0].label).toBe("Chrome no Android")
  })

  it("revoking the second device removes it from the list, and a revoked device learns it on its next check-in", async () => {
    await register("s-phone", "Chrome no Android")
    await register("s-pc", "Chrome no Windows")
    const pc = state.rows.find((r) => r.auth_session_id === "s-pc")!
    expect(await endSession(pc.id)).toEqual({ ok: true })
    expect((await listSessions()).sessions.map((s) => s.label)).toEqual(["Chrome no Android"])
    // The proxy of the revoked device asks register_session again: true means "you were ended, go to the login".
    expect((await register("s-pc", "Chrome no Windows")).data).toBe(true)
  })

  it("ends all the others but never this device", async () => {
    await register("s-phone", "Chrome no Android")
    await register("s-pc", "Chrome no Windows")
    await register("s-tablet", "Safari no iPad")
    expect(await endOtherSessions()).toEqual({ ok: true, ended: 2 })
    expect((await listSessions()).sessions.map((s) => s.label)).toEqual(["Chrome no Android"])
  })

  it("never lets one person end another person's session", async () => {
    state.uid = "u2"
    state.session = "s-other"
    await register("s-other", "Firefox no Linux")
    const theirs = state.rows[0]
    state.uid = "u1"
    state.session = "s-phone"
    expect(await endSession(theirs.id)).toMatchObject({ ok: false })
    expect(theirs.revoked_at).toBeNull()
  })

  it("says so (status missing) when the table does not exist, and still lists this device", async () => {
    state.tableMissing = true
    const { sessions, status } = await listSessions()
    expect(status).toBe("missing")
    expect(sessions).toHaveLength(1)
    expect(sessions[0].current).toBe(true)
  })
})

describe("when the database role cannot delete from auth.sessions", () => {
  it("ending one session or all the others says so in plain words and changes nothing", async () => {
    await register("s-phone", "Chrome no Android")
    await register("s-pc", "Chrome no Windows")
    state.noDelete = true
    const pc = state.rows.find((r) => r.auth_session_id === "s-pc")!
    expect(await endSession(pc.id)).toEqual({ ok: false, error: PERMISSION_MESSAGE })
    expect(await endOtherSessions()).toEqual({ ok: false, error: PERMISSION_MESSAGE })
    expect(state.rows.every((r) => r.revoked_at === null)).toBe(true)
  })
})
