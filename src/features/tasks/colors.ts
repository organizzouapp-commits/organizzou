import type { TaskView } from "./types"

/**
 * Colors people give to priorities, tags, categories and tasks. A value is a palette swatch id, a custom "#RRGGBB" or null
 * ("Sem cor"). The values live behind `LabelColorRepo`: today a localStorage adapter; the server adapter needs
 * `supabase/migrations/20261105000002_label_colors.sql` (prepared, NOT applied). Palette swatches of a TASK also go to the existing
 * `tasks.swatch` column, so those already follow the person across devices.
 */
export type ColorValue = string | null
export type LabelKind = "priority" | "tag" | "category" | "task"

export const HEX_RE = /^#[0-9a-fA-F]{6}$/
export const MAX_CUSTOM_COLORS = 8

export type BuiltInColor = { id: string; label: string; /** A CSS color: a theme token for the defaults, a hex for legacy swatches. */ hex: string; /** Ink for a check on top of the fill. */ ink: "light" | "dark" }

/** The five default label colors, in picker order ("Sem cor" is the ring before them and has no entry). Tokens differ per theme (globals.css). */
export const BUILT_IN_COLORS: BuiltInColor[] = [
  { id: "vermelho", label: "Vermelho", hex: "var(--label-red)", ink: "light" },
  { id: "amarelo", label: "Amarelo", hex: "var(--label-yellow)", ink: "dark" },
  { id: "azul", label: "Azul", hex: "var(--label-blue)", ink: "light" },
  { id: "laranja", label: "Laranja", hex: "var(--label-orange)", ink: "dark" },
  { id: "verde", label: "Verde", hex: "var(--label-green)", ink: "dark" },
]

/** Swatches earlier versions stored. They keep rendering (the picker lists them after the defaults, like saved custom colors); never wiped. */
export const LEGACY_COLORS: BuiltInColor[] = [
  { id: "cinza", label: "Cinza", hex: "#8C917F", ink: "dark" },
  { id: "lima", label: "Lima", hex: "#DBFD00", ink: "dark" },
  { id: "lima-verso", label: "Lima verso", hex: "#8FA800", ink: "dark" },
  { id: "tinta-verso", label: "Tinta verso", hex: "#4B5A00", ink: "light" },
  { id: "grafite", label: "Grafite", hex: "#1A1D12", ink: "light" },
  { id: "papel", label: "Papel", hex: "#F6F7F0", ink: "dark" },
]

const ALL_COLORS = [...BUILT_IN_COLORS, ...LEGACY_COLORS]

/** Swatch ids the `tasks.swatch` column accepts today (its CHECK constraint); the five defaults, "cinza" and custom hex stay local until 20261106000001 is applied. */
const COLUMN_SWATCHES = new Set(["lima", "lima-verso", "tinta-verso", "grafite", "papel"])

export const isHex = (value: string | null | undefined): value is string => Boolean(value) && HEX_RE.test(value as string)
export const normalizeHex = (value: string) => value.trim().toUpperCase()

export function resolveHex(value: ColorValue): string | null {
  if (!value) return null
  if (isHex(value)) return normalizeHex(value)
  return ALL_COLORS.find((c) => c.id === value)?.hex ?? null
}

export function colorLabel(value: ColorValue): string {
  if (!value) return "Sem cor"
  return ALL_COLORS.find((c) => c.id === value)?.label ?? normalizeHex(value)
}

export type LabelColorState = {
  colors: Record<LabelKind, Record<string, ColorValue>>
  /** Colors the person saved from the custom panel (at most 8). */
  custom: string[]
}

export const EMPTY_LABEL_COLORS: LabelColorState = { colors: { priority: {}, tag: {}, category: {}, task: {} }, custom: [] }

export type LabelColorRepo = {
  load(): LabelColorState
  save(state: LabelColorState): void
}

/** Ink of a check over a color: the swatch ink for ids, computed from luminance for hex. */
export function inkFor(value: ColorValue): "light" | "dark" {
  const known = ALL_COLORS.find((c) => c.id === value)
  if (known) return known.ink
  if (!value || !isHex(value)) return "dark"
  const n = parseInt(value.slice(1), 16)
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) > 0.4 ? "dark" : "light"
}

const STORAGE_KEY = "organizzou:tarefas-colors"

/** Tolerant reader: anything broken falls back to "no colors". */
export function parseLabelColors(raw: string | null): LabelColorState {
  if (!raw) return EMPTY_LABEL_COLORS
  try {
    const data = JSON.parse(raw) as Partial<LabelColorState>
    const colors = { priority: {}, tag: {}, category: {}, task: {} } as LabelColorState["colors"]
    for (const kind of Object.keys(colors) as LabelKind[]) {
      const source = data.colors?.[kind]
      if (!source || typeof source !== "object") continue
      for (const [key, value] of Object.entries(source)) {
        if (value === null || (typeof value === "string" && resolveHex(value))) colors[kind][key] = value
      }
    }
    const custom = Array.isArray(data.custom) ? [...new Set(data.custom.filter((c): c is string => typeof c === "string" && HEX_RE.test(c)).map(normalizeHex))].slice(0, MAX_CUSTOM_COLORS) : []
    return { colors, custom }
  } catch {
    return EMPTY_LABEL_COLORS
  }
}

export const localLabelColorRepo: LabelColorRepo = {
  load() {
    try {
      return parseLabelColors(window.localStorage.getItem(STORAGE_KEY))
    } catch {
      return EMPTY_LABEL_COLORS
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}

export const colorOf = (state: LabelColorState, kind: LabelKind, key: string): ColorValue => state.colors[kind][key] ?? null

export function withColor(state: LabelColorState, kind: LabelKind, key: string, value: ColorValue): LabelColorState {
  const next = { ...state.colors[kind] }
  if (value) next[key] = value
  else delete next[key]
  return { ...state, colors: { ...state.colors, [kind]: next } }
}

export function withCustom(state: LabelColorState, hex: string): LabelColorState {
  const value = normalizeHex(hex)
  if (!HEX_RE.test(value) || state.custom.includes(value) || state.custom.length >= MAX_CUSTOM_COLORS) return state
  return { ...state, custom: [...state.custom, value] }
}

export const withoutCustom = (state: LabelColorState, hex: string): LabelColorState => ({ ...state, custom: state.custom.filter((c) => c !== hex) })

/** The color of a task: its own local choice (custom or "Cinza"), else the palette swatch stored in `tasks.swatch`. */
export function taskColorOf(state: LabelColorState, task: Pick<TaskView, "id" | "swatch">): ColorValue {
  if (task.id in state.colors.task) return state.colors.task[task.id]
  return COLUMN_SWATCHES.has(task.swatch) ? task.swatch : null
}

/** What goes into `tasks.swatch` for a color: the palette id when the column accepts it, else the neutral default. */
export const columnSwatchFor = (value: ColorValue): string => (value && COLUMN_SWATCHES.has(value) ? value : "neutro")

/** The label tint: the color at 16% over the surface, a 1px border at 30%. Text stays the neutral foreground token. */
export function tintStyle(hex: string) {
  return { backgroundColor: `color-mix(in oklab, ${hex} 16%, var(--card))`, borderColor: `color-mix(in oklab, ${hex} 30%, transparent)` }
}
