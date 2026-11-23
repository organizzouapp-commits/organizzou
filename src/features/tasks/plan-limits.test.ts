import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ plan: "free" as "free" | "pro", boards: 0, lists: 0, inserts: [] as string[] }))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))
vi.mock("@/lib/plan-server", async () => {
  const { getEntitlements } = await import("@/lib/plans")
  return { getUserEntitlements: async (_s: unknown, _u: string, isAdmin: boolean) => getEntitlements({ plan: state.plan, isAdmin }) }
})
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "u1" } } }) },
    from: (table: string) => {
      const count = () => ({ count: table === "boards" ? state.boards : state.lists, error: null })
      return {
        select: () => {
          const q = { eq: () => Object.assign(Promise.resolve(count()), { order: () => ({ limit: async () => ({ data: [], error: null }) }) }), order: () => ({ limit: async () => ({ data: [], error: null }) }), then: (resolve: (v: unknown) => void) => resolve(count()) }
          return q
        },
        // anything past the limit check fails, which is enough to tell "allowed" from "blocked"
        insert: () => (state.inserts.push(table), { select: () => ({ single: async () => ({ data: null, error: { message: "stop" } }) }) }),
      }
    },
  }),
}))

import { createBoard, createList } from "./actions"

const BOARD = "7b9f1c2e-1111-4222-8333-444455556666"

beforeEach(() => {
  state.plan = "free"
  state.boards = 0
  state.lists = 0
  state.inserts = []
})

describe("Free limits on tasks (server side)", () => {
  it("the first board is allowed, the second is refused with the plan code and a clear message", async () => {
    expect((await createBoard({ name: "Meu quadro" })).ok).toBe(false) // passes the limit, stops at the fake insert
    expect(state.inserts).toEqual(["boards"])
    state.inserts = []
    state.boards = 1
    const refused = await createBoard({ name: "Outro" })
    expect(refused).toMatchObject({ ok: false, code: "plan", error: expect.stringContaining("Você usou seu 1 quadro de tarefas") })
    expect(state.inserts).toEqual([])
  })
  it("the 4th list is refused: Você usou suas 3 listas", async () => {
    state.lists = 2
    expect(await createList({ boardId: BOARD, name: "Quarta" })).not.toMatchObject({ code: "plan" })
    state.lists = 3
    const refused = await createList({ boardId: BOARD, name: "Quarta" })
    expect(refused).toMatchObject({ ok: false, code: "plan", error: expect.stringContaining("Você usou suas 3 listas de tarefas") })
  })
  it("someone already over the limit (a lapsed Pro with 5 lists) can read and edit, but not create", async () => {
    state.lists = 5
    expect(await createList({ boardId: BOARD, name: "Sexta" })).toMatchObject({ code: "plan" })
  })
  it("Pro has no limit", async () => {
    state.plan = "pro"
    state.boards = 9
    state.lists = 40
    expect(await createBoard({ name: "Mais um" })).not.toMatchObject({ code: "plan" })
    expect(await createList({ boardId: BOARD, name: "Mais uma" })).not.toMatchObject({ code: "plan" })
  })
})

describe("the screens", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
  it("the locked module screen and the limit dialog say what the design says and link to the plan tab", () => {
    const locked = read("src/components/plan/locked-module.tsx")
    for (const text of ["faz parte do Pro", "Experimentar por R$ 4,90", "Ver todos os planos", "continuam guardados"]) expect(locked).toContain(text)
    expect(locked).toContain("PLANS_HREF")
    const limit = read("src/components/plan/limit-dialog.tsx")
    expect(limit).toContain("Você usou suas")
    expect(limit).toContain("Agora não")
    expect(limit).toContain("PLANS_HREF")
  })
  it("the menu shows a lock and the page is wrapped, in the sidebar, the phone drawer and the shell", () => {
    expect(read("src/components/shell/app-sidebar.tsx")).toContain("<NavLock")
    expect(read("src/components/shell/others-drawer.tsx")).toContain("<NavLock")
    expect(read("src/components/shell/app-shell.tsx")).toContain("<ModuleLock>")
  })
  it("the tasks board opens the limit dialog on the plan code instead of a plain error", () => {
    const board = read("src/components/tasks/board-client.tsx")
    expect(board).toContain('planLimit.show("lists")')
    expect(board).toContain('planLimit.show("boards")')
  })
  it("the assistant locked state sends Free people to the plan screen", () => {
    const sheet = read("src/components/assistant/assistant-sheet.tsx")
    expect(sheet).toContain("Conhecer o Pro")
    expect(sheet).toContain("PLANS_HREF")
  })
})
