import { describe, expect, it } from "vitest"

import { ageLabel, countdownText, lastBackupLabel, vaultHealth } from "./health"
import type { VaultItemType } from "./types"

// Fake strings only: nothing here resembles a real credential.
const STRONG_A = "r7#Kp9!vQ2$mZx4L"
const STRONG_B = "Zt4&nB8*wE1@cY6u"
const MEDIUM = "Viagem@2024"
const WEAK = "123456"
const item = (id: string, password?: string, type: VaultItemType = "login") => ({ id, type, password })

describe("vaultHealth", () => {
  it("is the share of passwords that are strong and not used elsewhere", () => {
    const h = vaultHealth([item("a", STRONG_A), item("b", STRONG_B), item("c", MEDIUM), item("d", WEAK)])
    expect(h.passwords).toBe(4)
    expect(h.strongUnique).toBe(2)
    expect(h.percent).toBe(50)
    expect(h.weakIds).toEqual(["d"])
    expect(h.reusedGroups).toEqual([])
    expect(h.uniqueIds.sort()).toEqual(["a", "b", "c", "d"])
  })

  it("does not count a strong password that two items share", () => {
    const h = vaultHealth([item("a", STRONG_A), item("b", STRONG_A), item("c", STRONG_B)])
    expect(h.strongUnique).toBe(1)
    expect(h.percent).toBe(33)
    expect(h.reusedGroups.map((g) => g.sort())).toEqual([["a", "b"]])
    expect(h.reusedItems).toBe(2)
    expect(h.uniqueIds).toEqual(["c"])
  })

  it("groups each repeated password apart and counts the items in them", () => {
    const h = vaultHealth([item("a", WEAK), item("b", WEAK), item("c", WEAK), item("d", MEDIUM), item("e", MEDIUM), item("f", STRONG_A)])
    expect(h.reusedGroups).toHaveLength(2)
    expect(h.reusedItems).toBe(5)
    expect(h.weakIds.sort()).toEqual(["a", "b", "c"])
  })

  it("is 100% when every password is strong and unique, and 0% when none is", () => {
    expect(vaultHealth([item("a", STRONG_A), item("b", STRONG_B)]).percent).toBe(100)
    expect(vaultHealth([item("a", WEAK), item("b", MEDIUM)]).percent).toBe(0)
  })

  it("only judges items of the Senha type that have a password", () => {
    const h = vaultHealth([item("a", STRONG_A), item("b", undefined), item("c", "4111111111111111", "card"), item("d", undefined, "document"), item("e", undefined, "secure_note")])
    expect(h.passwords).toBe(1)
    expect(h.percent).toBe(100)
    expect(h.items).toBe(5)
    expect(h.byType).toEqual({ login: 2, card: 1, document: 1, secure_note: 1 })
  })

  it("has no percentage without passwords, and is all zero for an empty vault", () => {
    expect(vaultHealth([item("c", undefined, "card")]).percent).toBeNull()
    expect(vaultHealth([])).toMatchObject({ items: 0, passwords: 0, percent: null, weakIds: [], reusedGroups: [], reusedItems: 0 })
  })

  it("never returns a password", () => {
    expect(JSON.stringify(vaultHealth([item("a", STRONG_A), item("b", WEAK)]))).not.toContain(STRONG_A)
  })
})

describe("ageLabel", () => {
  const now = new Date("2026-11-10T12:00:00Z")
  it("says how long ago, in words", () => {
    expect(ageLabel("2026-11-10T08:00:00Z", now)).toBe("hoje")
    expect(ageLabel("2026-11-09T08:00:00Z", now)).toBe("ontem")
    expect(ageLabel("2026-11-03T12:00:00Z", now)).toBe("há 7 dias")
    expect(ageLabel("2026-10-05T12:00:00Z", now)).toBe("há 1 mês")
    expect(ageLabel("2026-05-01T12:00:00Z", now)).toBe("há 6 meses")
    expect(ageLabel("2025-10-01T12:00:00Z", now)).toBe("há 1 ano")
    expect(ageLabel("2023-01-01T12:00:00Z", now)).toBe("há 3 anos")
  })
  it("never goes negative for a time in the future", () => {
    expect(ageLabel("2026-12-01T12:00:00Z", now)).toBe("hoje")
  })
})

describe("countdownText", () => {
  it("formats seconds as m:ss", () => {
    expect(countdownText(300)).toBe("5:00")
    expect(countdownText(65)).toBe("1:05")
    expect(countdownText(9)).toBe("0:09")
    expect(countdownText(-4)).toBe("0:00")
    expect(countdownText(899.4)).toBe("14:59")
  })
})

describe("the security report (weak and repeated passwords)", () => {
  it("lists an item that is both weak and repeated once in each list, and leaves unique strong ones out", () => {
    const h = vaultHealth([item("a", WEAK), item("b", WEAK), item("c", STRONG_A), item("d", MEDIUM)])
    expect(h.weakIds).toEqual(["a", "b"])
    expect(h.reusedGroups).toEqual([["a", "b"]])
    expect(h.reusedItems).toBe(2)
    expect([...h.weakIds, ...h.reusedGroups.flat()].includes("c")).toBe(false)
  })

  it("finds several repeated groups and ignores empty passwords", () => {
    const h = vaultHealth([item("a", STRONG_A), item("b", STRONG_A), item("c", STRONG_B), item("d", STRONG_B), item("e", STRONG_B), item("f", ""), item("g", undefined)])
    expect(h.reusedGroups).toEqual([["a", "b"], ["c", "d", "e"]])
    expect(h.passwords).toBe(5)
  })

  it("does not compare passwords by case or trimming: only exact copies are repeats", () => {
    const h = vaultHealth([item("a", STRONG_A), item("b", STRONG_A.toLowerCase())])
    expect(h.reusedGroups).toEqual([])
  })
})

describe("lastBackupLabel", () => {
  it("says nunca before the first backup, and the day afterwards", () => {
    expect(lastBackupLabel(null)).toBe("nunca")
    expect(lastBackupLabel("not a date")).toBe("nunca")
    expect(lastBackupLabel("2026-11-10T15:00:00.000Z")).toBe("10 de nov 2026")
  })
})
