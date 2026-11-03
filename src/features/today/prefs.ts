import { z } from "zod"

import { isPanelId, isStatId, PANEL_WIDGETS, STAT_IDS, type PanelId, type StatId } from "./catalog"

/**
 * Preferences of the "Hoje" page. Versioned: older saves are migrated, never discarded.
 *
 *   v1  highlights: exactly 4 stat ids, panels
 *   v2  highlights: EVERY catalog stat, in order, each with an `enabled` switch (any number can be on, zero hides the section)
 *       panels:          every panel with its visibility and order ("seu-dia" can be hidden, never removed)
 *       collapsedGroups: the person's explicit choice per "Seu dia" group (true = folded, false = open). No entry = smart default.
 *       overdueSeen:     ids of the overdue items present when "Atrasados" was folded, so a NEW overdue item opens it again
 *       expandedPanels:  side panels the person left open (they start folded). The FIRST visible side panel is never read from here: it opens on every load
 */
export const PREFS_VERSION = 2

export const GROUP_IDS = ["atrasados", "hoje", "habitos", "concluidos", "amanha", "manha", "tarde", "noite", "sem-horario"] as const
export type GroupId = (typeof GROUP_IDS)[number]

export const prefsSchema = z.object({
  version: z.literal(PREFS_VERSION),
  highlights: z.array(z.object({ id: z.string(), enabled: z.boolean() })),
  panels: z.array(z.object({ id: z.string(), visible: z.boolean() })),
  collapsedGroups: z.record(z.string(), z.boolean()),
  overdueSeen: z.array(z.string()).max(100),
  expandedPanels: z.array(z.string()),
})

export type Highlight = { id: StatId; enabled: boolean }

export type TodayPrefs = {
  version: typeof PREFS_VERSION
  highlights: Highlight[]
  panels: { id: PanelId; visible: boolean }[]
  collapsedGroups: Partial<Record<GroupId, boolean>>
  overdueSeen: string[]
  expandedPanels: PanelId[]
}

/** The order a new person sees: the daily essentials first, then the rest of the catalog. */
const FIRST: StatId[] = ["tarefas-hoje", "habitos-hoje", "proximo-evento", "gasto-hoje", "agua", "calorias"]
export const DEFAULT_ORDER: StatId[] = [...FIRST, ...STAT_IDS.filter((id) => !FIRST.includes(id))]

export const DEFAULT_PREFS: TodayPrefs = {
  version: PREFS_VERSION,
  highlights: DEFAULT_ORDER.map((id) => ({ id, enabled: true })),
  panels: PANEL_WIDGETS.map((w) => ({ id: w.id, visible: w.defaultVisible })),
  collapsedGroups: {},
  overdueSeen: [],
  expandedPanels: [],
}

/** localStorage key and cookie name that mirror the saved preferences (see `savePrefs`). */
export const PREFS_STORAGE_KEY = "organizzou:hoje-prefs"
export const PREFS_COOKIE = "hoje_prefs"

const looseSchema = z.object({
  highlights: z.array(z.unknown()).optional(),
  panels: z.array(z.object({ id: z.unknown(), visible: z.unknown().optional() })).optional(),
  collapsedGroups: z.record(z.string(), z.unknown()).optional(),
  overdueSeen: z.array(z.unknown()).optional(),
  expandedPanels: z.array(z.unknown()).optional(),
})

/**
 * Turns anything (a v1 or v2 save, hand-edited JSON, null) into valid v2 prefs. Never throws.
 *  - v1 -> v2: the 4 old picks come first in their order, every other catalog stat is appended and enabled.
 *  - unknown / removed ids are dropped, duplicates collapse;
 *  - catalog stats added after the save are appended, enabled; panels added later appear at the end with their default visibility.
 */
export function normalizePrefs(raw: unknown): TodayPrefs {
  const loose = looseSchema.safeParse(raw)
  if (!loose.success) return DEFAULT_PREFS
  const data = loose.data

  const highlights: Highlight[] = []
  for (const entry of data.highlights ?? []) {
    // v1 stored plain ids; v2 stores { id, enabled }.
    const id = typeof entry === "string" ? entry : (entry as { id?: unknown } | null)?.id
    const enabled = typeof entry === "string" ? true : typeof (entry as { enabled?: unknown } | null)?.enabled === "boolean" ? (entry as { enabled: boolean }).enabled : true
    if (isStatId(id) && !highlights.some((h) => h.id === id)) highlights.push({ id, enabled })
  }
  const known = new Set(highlights.map((h) => h.id))
  for (const id of DEFAULT_ORDER) if (!known.has(id)) highlights.push({ id, enabled: true })

  const panels: TodayPrefs["panels"] = []
  for (const p of data.panels ?? []) {
    if (isPanelId(p.id) && !panels.some((x) => x.id === p.id)) panels.push({ id: p.id, visible: typeof p.visible === "boolean" ? p.visible : true })
  }
  for (const w of PANEL_WIDGETS) if (!panels.some((x) => x.id === w.id)) panels.push({ id: w.id, visible: w.defaultVisible })

  const collapsedGroups: TodayPrefs["collapsedGroups"] = {}
  for (const [key, value] of Object.entries(data.collapsedGroups ?? {})) {
    if ((GROUP_IDS as readonly string[]).includes(key) && typeof value === "boolean") collapsedGroups[key as GroupId] = value
  }

  const overdueSeen = (data.overdueSeen ?? []).filter((v): v is string => typeof v === "string").slice(0, 100)
  const expandedPanels = [...new Set((data.expandedPanels ?? []).filter(isPanelId))]

  return { version: PREFS_VERSION, highlights, panels, collapsedGroups, overdueSeen, expandedPanels }
}

/** Parses a JSON string (cookie / localStorage). Returns null when there is nothing usable, so callers can fall through to defaults. */
export function parsePrefsJson(text: string | null | undefined): TodayPrefs | null {
  if (!text) return null
  try {
    return normalizePrefs(JSON.parse(text))
  } catch {
    return null
  }
}

export function prefsEqual(a: TodayPrefs, b: TodayPrefs) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The side panel that renders open on every load, whatever was saved: the first visible one that is not "Seu dia". */
export const firstSidePanel = (prefs: TodayPrefs): PanelId | undefined => prefs.panels.find((p) => p.visible && p.id !== "seu-dia")?.id

export const enabledHighlights = (prefs: TodayPrefs) => prefs.highlights.filter((h) => h.enabled).map((h) => h.id)
export const visiblePanels = (prefs: TodayPrefs) => prefs.panels.filter((p) => p.visible).map((p) => p.id)

/** Every widget key a layout needs: the enabled highlights ("stat:<id>") and the visible panels ("panel:<id>"). */
export const wantedKeys = (prefs: TodayPrefs) => [...enabledHighlights(prefs).map((id) => `stat:${id}`), ...visiblePanels(prefs).map((id) => `panel:${id}`)]
