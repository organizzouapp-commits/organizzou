import { describe, expect, it } from "vitest"

import { AUTO_LOCK_OPTIONS, DEFAULT_SETTINGS, parseSettings } from "./settings"

describe("vault settings", () => {
  it("offers 1, 5, 15 and 30 minutes and locking when the tab closes", () => {
    expect(AUTO_LOCK_OPTIONS.map((o) => o.value)).toEqual(["1", "5", "15", "30", "hidden"])
    expect(AUTO_LOCK_OPTIONS.at(-1)?.label).toBe("Ao fechar a aba")
  })

  it("keeps valid values", () => {
    expect(parseSettings({ autoLock: "30", lastBackupAt: "2026-11-10T15:00:00.000Z" })).toEqual({ autoLock: "30", lastBackupAt: "2026-11-10T15:00:00.000Z" })
  })

  it("falls back to the defaults for anything unknown and drops extra fields", () => {
    expect(parseSettings({ autoLock: "999", lastBackupAt: "yesterday", password: "x" })).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(Object.keys(parseSettings({ autoLock: "1", extra: 1 })).sort()).toEqual(["autoLock", "lastBackupAt"])
  })
})
