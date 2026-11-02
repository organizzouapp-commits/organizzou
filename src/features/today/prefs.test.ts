import { describe, expect, it } from "vitest"

import { PANEL_IDS, STAT_IDS } from "./catalog"
import { DEFAULT_PREFS, enabledHighlights, firstSidePanel, normalizePrefs, parsePrefsJson, prefsSchema } from "./prefs"

describe("today prefs v2", () => {
  it("a new person gets every catalog stat enabled, essentials first, and every panel visible but folded", () => {
    expect(prefsSchema.safeParse(DEFAULT_PREFS).success).toBe(true)
    expect(DEFAULT_PREFS.highlights.map((h) => h.id).slice(0, 6)).toEqual(["tarefas-hoje", "habitos-hoje", "proximo-evento", "gasto-hoje", "agua", "calorias"])
    expect(DEFAULT_PREFS.highlights).toHaveLength(STAT_IDS.length)
    expect(DEFAULT_PREFS.highlights.every((h) => h.enabled)).toBe(true)
    expect(DEFAULT_PREFS.panels.map((p) => p.id)).toEqual(PANEL_IDS)
    expect(DEFAULT_PREFS.panels.every((p) => p.visible)).toBe(true)
    expect(DEFAULT_PREFS.expandedPanels).toEqual([])
    expect(DEFAULT_PREFS.collapsedGroups).toEqual({})
  })

  it("migrates v1: the old 4 picks come first in their order, everything else is appended and enabled", () => {
    const v1 = { version: 1, highlights: ["sono", "agua", "peso", "sequencia"], panels: [{ id: "humor", visible: false }, { id: "seu-dia", visible: true }] }
    const prefs = normalizePrefs(v1)
    expect(prefs.version).toBe(2)
    expect(prefs.highlights.slice(0, 4).map((h) => h.id)).toEqual(["sono", "agua", "peso", "sequencia"])
    expect(prefs.highlights).toHaveLength(STAT_IDS.length)
    expect(prefs.highlights.every((h) => h.enabled)).toBe(true)
    expect(new Set(prefs.highlights.map((h) => h.id)).size).toBe(STAT_IDS.length)
    expect(prefs.panels.slice(0, 2)).toEqual([{ id: "humor", visible: false }, { id: "seu-dia", visible: true }])
    expect(prefs.panels.map((p) => p.id).sort()).toEqual([...PANEL_IDS].sort())
  })

  it("keeps a v2 save as it is (order, switches, folded groups, open panels)", () => {
    const saved = {
      version: 2,
      highlights: [{ id: "sono", enabled: false }, { id: "agua", enabled: true }],
      panels: [{ id: "notas", visible: false }],
      collapsedGroups: { atrasados: true, manha: false },
      overdueSeen: ["t1", "t2"],
      expandedPanels: ["financas", "dieta"],
    }
    const prefs = normalizePrefs(saved)
    expect(prefs.highlights.slice(0, 2)).toEqual([{ id: "sono", enabled: false }, { id: "agua", enabled: true }])
    expect(enabledHighlights(prefs)).not.toContain("sono")
    expect(prefs.collapsedGroups).toEqual({ atrasados: true, manha: false })
    expect(prefs.overdueSeen).toEqual(["t1", "t2"])
    expect(prefs.expandedPanels).toEqual(["financas", "dieta"])
    expect(prefs.panels[0]).toEqual({ id: "notas", visible: false })
  })

  it("stats added to the catalog after a save show up at the end, enabled", () => {
    const prefs = normalizePrefs({ version: 2, highlights: [{ id: "agua", enabled: false }] })
    expect(prefs.highlights[0]).toEqual({ id: "agua", enabled: false })
    expect(prefs.highlights.slice(1).every((h) => h.enabled)).toBe(true)
    expect(prefs.highlights).toHaveLength(STAT_IDS.length)
  })

  it("ignores unknown ids, bad group names and duplicates", () => {
    const prefs = normalizePrefs({
      highlights: [{ id: "nao-existe", enabled: true }, { id: "agua", enabled: true }, { id: "agua", enabled: false }],
      panels: [{ id: "removido", visible: true }, { id: "notas", visible: false }, { id: "notas", visible: true }],
      collapsedGroups: { lixo: true, tarde: "sim", noite: true },
      expandedPanels: ["financas", "financas", "nada"],
    })
    expect(prefs.highlights.filter((h) => h.id === "agua")).toEqual([{ id: "agua", enabled: true }])
    expect(prefs.highlights.some((h) => (h.id as string) === "nao-existe")).toBe(false)
    expect(prefs.panels.find((p) => p.id === "notas")).toEqual({ id: "notas", visible: false })
    expect(prefs.collapsedGroups).toEqual({ noite: true })
    expect(prefs.expandedPanels).toEqual(["financas"])
  })

  it("zero enabled is allowed (the section is simply hidden) and garbage falls back to the defaults", () => {
    const prefs = normalizePrefs({ version: 2, highlights: STAT_IDS.map((id) => ({ id, enabled: false })) })
    expect(enabledHighlights(prefs)).toEqual([])
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

  it("the first visible side panel is the one that always opens: Notas by default, the next one when it is hidden or moved", () => {
    expect(firstSidePanel(DEFAULT_PREFS)).toBe("notas")
    const hidden = { ...DEFAULT_PREFS, panels: DEFAULT_PREFS.panels.map((p) => (p.id === "notas" ? { ...p, visible: false } : p)) }
    expect(firstSidePanel(hidden)).toBe("financas")
    expect(firstSidePanel({ ...DEFAULT_PREFS, panels: [...DEFAULT_PREFS.panels].reverse() })).toBe("humor")
  })
})
