import { describe, expect, it } from "vitest"

import { PANEL_IDS, STAT_IDS } from "./catalog"
import { DEFAULT_PREFS, normalizePrefs, parsePrefsJson, prefsSchema } from "./prefs"

describe("today prefs", () => {
  it("the defaults are valid: 4 highlights (tasks, habits, spend, water) and every panel visible", () => {
    expect(prefsSchema.safeParse(DEFAULT_PREFS).success).toBe(true)
    expect(DEFAULT_PREFS.highlights).toEqual(["tarefas-hoje", "habitos-hoje", "gasto-hoje", "agua"])
    expect(DEFAULT_PREFS.panels.map((p) => p.id)).toEqual(PANEL_IDS)
    expect(DEFAULT_PREFS.panels.every((p) => p.visible)).toBe(true)
  })

  it("keeps a valid save as it is", () => {
    const saved = { version: 1, highlights: ["sono", "agua", "peso", "sequencia"], panels: [{ id: "humor", visible: false }, { id: "seu-dia", visible: true }] }
    const prefs = normalizePrefs(saved)
    expect(prefs.highlights).toEqual(["sono", "agua", "peso", "sequencia"])
    expect(prefs.panels.slice(0, 2)).toEqual([{ id: "humor", visible: false }, { id: "seu-dia", visible: true }])
    // Panels missing from an older save come back at the end, with their default visibility.
    expect(prefs.panels.map((p) => p.id).sort()).toEqual([...PANEL_IDS].sort())
  })

  it("ignores unknown or removed ids and collapses duplicates", () => {
    const prefs = normalizePrefs({ version: 1, highlights: ["nao-existe", "agua", "agua", "sono"], panels: [{ id: "removido", visible: true }, { id: "notas", visible: false }, { id: "notas", visible: true }] })
    expect(prefs.highlights.filter((id) => id === "agua")).toHaveLength(1)
    expect(prefs.highlights).not.toContain("nao-existe")
    expect(prefs.highlights).toHaveLength(4)
    expect(prefs.highlights.every((id) => (STAT_IDS as string[]).includes(id))).toBe(true)
    expect(prefs.panels.find((p) => p.id === "notas")).toEqual({ id: "notas", visible: false })
    expect(prefs.panels.some((p) => (p.id as string) === "removido")).toBe(false)
  })

  it("tops up to 4 highlights and falls back to the defaults on garbage", () => {
    expect(normalizePrefs({ highlights: ["sono"] }).highlights).toHaveLength(4)
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(normalizePrefs("texto")).toEqual(DEFAULT_PREFS)
    expect(normalizePrefs({ highlights: 5, panels: "x" })).toEqual(DEFAULT_PREFS)
  })

  it("parses JSON text from a cookie or localStorage, and returns null when there is nothing usable", () => {
    expect(parsePrefsJson(JSON.stringify(DEFAULT_PREFS))).toEqual(DEFAULT_PREFS)
    expect(parsePrefsJson("{not json")).toBeNull()
    expect(parsePrefsJson("")).toBeNull()
    expect(parsePrefsJson(null)).toBeNull()
  })
})
