import { z } from "zod"

import { isPanelId, isStatId, PANEL_WIDGETS, STAT_WIDGETS, type PanelId, type StatId } from "./catalog"

/**
 * Preferences of the "Hoje" page. Versioned, so a later shape can migrate old saves instead of discarding them.
 *   highlights: exactly 4 stat ids, in display order
 *   panels:     every panel with its visibility, in display order ("seu-dia" can be hidden, never removed)
 */
export const PREFS_VERSION = 1

export const prefsSchema = z.object({
  version: z.literal(PREFS_VERSION),
  highlights: z.array(z.string()).length(4),
  panels: z.array(z.object({ id: z.string(), visible: z.boolean() })),
})

export type TodayPrefs = { version: typeof PREFS_VERSION; highlights: StatId[]; panels: { id: PanelId; visible: boolean }[] }

export const DEFAULT_HIGHLIGHTS: StatId[] = STAT_WIDGETS.filter((w) => w.defaultVisible).map((w) => w.id)

export const DEFAULT_PREFS: TodayPrefs = {
  version: PREFS_VERSION,
  highlights: DEFAULT_HIGHLIGHTS,
  panels: PANEL_WIDGETS.map((w) => ({ id: w.id, visible: w.defaultVisible })),
}

/** localStorage key and cookie name that mirror the saved preferences (see docs and `savePrefs`). */
export const PREFS_STORAGE_KEY = "organizzou:hoje-prefs"
export const PREFS_COOKIE = "hoje_prefs"

/**
 * Turns anything (a saved value of an older or newer version, hand-edited JSON, null) into valid prefs. Never throws:
 * unknown or removed ids are dropped, duplicates collapse, the 4 highlights are topped up from the defaults, and panels added to
 * the catalog after the save show up at the end with their default visibility.
 */
export function normalizePrefs(raw: unknown): TodayPrefs {
  const loose = z
    .object({ highlights: z.array(z.unknown()).optional(), panels: z.array(z.object({ id: z.unknown(), visible: z.unknown().optional() })).optional() })
    .safeParse(raw)
  if (!loose.success) return DEFAULT_PREFS

  const highlights: StatId[] = []
  for (const id of loose.data.highlights ?? []) if (isStatId(id) && !highlights.includes(id)) highlights.push(id)
  for (const id of DEFAULT_HIGHLIGHTS) if (highlights.length < 4 && !highlights.includes(id)) highlights.push(id)
  for (const w of STAT_WIDGETS) if (highlights.length < 4 && !highlights.includes(w.id)) highlights.push(w.id)

  const panels: TodayPrefs["panels"] = []
  for (const p of loose.data.panels ?? []) {
    if (isPanelId(p.id) && !panels.some((x) => x.id === p.id)) panels.push({ id: p.id, visible: typeof p.visible === "boolean" ? p.visible : true })
  }
  for (const w of PANEL_WIDGETS) if (!panels.some((x) => x.id === w.id)) panels.push({ id: w.id, visible: w.defaultVisible })

  return { version: PREFS_VERSION, highlights: highlights.slice(0, 4), panels }
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

export const visiblePanels = (prefs: TodayPrefs) => prefs.panels.filter((p) => p.visible).map((p) => p.id)
