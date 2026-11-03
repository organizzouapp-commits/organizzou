import { applyFilters, EMPTY_FILTERS, type DueFilter, type TaskFilters } from "./filters"
import type { Priority, TaskView } from "./types"
import { PRIORITIES } from "./types"
import { isPending } from "./view"

/**
 * Editable shortcut chips (Todas, Hoje, Esta semana, Atrasadas, Sem data + the person's own). A shortcut is a name plus filter
 * criteria. Built-ins can be hidden and reordered, never renamed or deleted. Stored per person in localStorage for now (see
 * `loadShortcuts`/`saveShortcuts`); a per-user preferences column can replace the storage without touching the screens.
 */
export type ShortcutCriteria = {
  due: DueFilter
  range: { from: string | null; to: string | null } | null
  listIds: string[]
  tagIds: string[]
  priorities: Priority[]
  categories: string[]
  query: string
}

export type ShortcutDef = {
  id: string
  label: string
  builtin: boolean
  hidden: boolean
  /** Pinned chips stay visible at 0 pending tasks. */
  pinned: boolean
  criteria: ShortcutCriteria
}

export const EMPTY_CRITERIA: ShortcutCriteria = { due: "all", range: null, listIds: [], tagIds: [], priorities: [], categories: [], query: "" }

const builtin = (id: string, label: string, due: DueFilter): ShortcutDef => ({ id, label, builtin: true, hidden: false, pinned: id === "todas", criteria: { ...EMPTY_CRITERIA, due } })

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  builtin("todas", "Todas", "all"),
  builtin("hoje", "Hoje", "today"),
  builtin("semana", "Esta semana", "week"),
  builtin("atrasadas", "Atrasadas", "overdue"),
  builtin("sem-data", "Sem data", "none"),
]

export const STORAGE_KEY = "organizzou:tarefas-shortcuts"

const DUES: DueFilter[] = ["all", "overdue", "today", "week", "none"]

/** Reads what was saved, tolerating anything: unknown or broken entries are dropped and missing built-ins come back at the end. */
export function parseShortcuts(raw: string | null): ShortcutDef[] {
  if (!raw) return DEFAULT_SHORTCUTS
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return DEFAULT_SHORTCUTS
  }
  if (!Array.isArray(data)) return DEFAULT_SHORTCUTS
  const out: ShortcutDef[] = []
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue
    const e = entry as Partial<ShortcutDef> & { criteria?: Partial<ShortcutCriteria> }
    if (typeof e.id !== "string" || typeof e.label !== "string") continue
    const base = DEFAULT_SHORTCUTS.find((d) => d.id === e.id)
    const c: Partial<ShortcutCriteria> = e.criteria ?? {}
    out.push({
      id: e.id,
      label: base ? base.label : e.label.trim().slice(0, 40) || "Atalho",
      builtin: Boolean(base),
      hidden: Boolean(e.hidden),
      pinned: Boolean(e.pinned) || e.id === "todas",
      criteria: base
        ? base.criteria
        : {
            due: DUES.includes(c.due as DueFilter) ? (c.due as DueFilter) : "all",
            range: c.range && typeof c.range === "object" ? { from: c.range.from ?? null, to: c.range.to ?? null } : null,
            listIds: Array.isArray(c.listIds) ? c.listIds.filter((v): v is string => typeof v === "string") : [],
            tagIds: Array.isArray(c.tagIds) ? c.tagIds.filter((v): v is string => typeof v === "string") : [],
            priorities: Array.isArray(c.priorities) ? c.priorities.filter((v): v is Priority => (PRIORITIES as readonly string[]).includes(v as string)) : [],
            categories: Array.isArray(c.categories) ? c.categories.filter((v): v is string => typeof v === "string") : [],
            query: typeof c.query === "string" ? c.query : "",
          },
    })
  }
  for (const d of DEFAULT_SHORTCUTS) if (!out.some((o) => o.id === d.id)) out.push(d)
  return out
}

export function loadShortcuts(): ShortcutDef[] {
  try {
    return parseShortcuts(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_SHORTCUTS
  }
}

export function saveShortcuts(defs: ShortcutDef[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defs))
  } catch {
    // Private mode: the choice just does not survive the visit.
  }
}

/** The board filters a chip applies (the person's own filters are replaced, "Mostrar concluídas" is kept). */
export function criteriaToFilters(c: ShortcutCriteria, keep: Pick<TaskFilters, "showCompleted">): TaskFilters {
  return { ...EMPTY_FILTERS, showCompleted: keep.showCompleted, due: c.due, range: c.range, listIds: c.listIds, tagIds: c.tagIds, priorities: c.priorities, categories: c.categories, query: c.query }
}

export function filtersToCriteria(f: TaskFilters): ShortcutCriteria {
  return { due: f.due, range: f.range, listIds: f.listIds, tagIds: f.tagIds, priorities: f.priorities, categories: f.categories, query: f.query.trim() }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** True when the current filters are exactly this shortcut (a query typed on top of a shortcut without text does not unselect it). */
export function isActiveShortcut(def: ShortcutDef, f: TaskFilters) {
  const c = def.criteria
  return (
    c.due === f.due &&
    same(c.range, f.range) &&
    same([...c.listIds].sort(), [...f.listIds].sort()) &&
    same([...c.tagIds].sort(), [...f.tagIds].sort()) &&
    same([...c.priorities].sort(), [...f.priorities].sort()) &&
    same([...c.categories].sort(), [...f.categories].sort()) &&
    (c.query === "" || c.query === f.query.trim())
  )
}

/** Pending tasks a shortcut matches (the number on its chip). */
export function countForShortcut(def: ShortcutDef, tasks: TaskView[], context: { now: Date; timeZone: string }) {
  return applyFilters(tasks.filter(isPending), criteriaToFilters(def.criteria, { showCompleted: true }), context).length
}

export function newShortcutId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
