import { describe, expect, it, vi } from "vitest"

import { commitDelete, flushPendingDeletes, hasPendingDelete, startDelete, undoDelete } from "./pending-delete"
import type { VaultItem } from "./types"

const item = (id: string): VaultItem => ({ id, type: "secure_note", name: `Nota ${id}`, updated_at: "2026-11-10T12:00:00.000Z" })

describe("pending delete", () => {
  it("keeps the item in memory and does not erase anything until committed", async () => {
    const erase = vi.fn()
    startDelete(item("a"), erase)
    expect(hasPendingDelete("a")).toBe(true)
    expect(erase).not.toHaveBeenCalled()
    await commitDelete("a")
    expect(erase).toHaveBeenCalledTimes(1)
    expect(hasPendingDelete("a")).toBe(false)
  })

  it("undo gives the same item back and nothing is erased afterwards", async () => {
    const erase = vi.fn()
    const original = item("b")
    startDelete(original, erase)
    expect(undoDelete("b")).toBe(original)
    await commitDelete("b")
    expect(erase).not.toHaveBeenCalled()
  })

  it("committing twice, or undoing after the commit, does nothing", async () => {
    const erase = vi.fn()
    startDelete(item("c"), erase)
    await commitDelete("c")
    await commitDelete("c")
    expect(erase).toHaveBeenCalledTimes(1)
    expect(undoDelete("c")).toBeNull()
  })

  it("flush erases everything that is pending", async () => {
    const eraseD = vi.fn()
    const eraseE = vi.fn()
    startDelete(item("d"), eraseD)
    startDelete(item("e"), eraseE)
    await flushPendingDeletes()
    expect(eraseD).toHaveBeenCalledTimes(1)
    expect(eraseE).toHaveBeenCalledTimes(1)
    expect(hasPendingDelete("d") || hasPendingDelete("e")).toBe(false)
  })
})
