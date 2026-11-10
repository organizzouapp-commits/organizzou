// How the Metas page is folded: which goal cards are collapsed and whether the Concluídas section is open. A view preference, kept on this
// device (localStorage) behind a small repository, so it can move to the profile later without touching the screen.
export type GoalViewState = { collapsed: string[]; doneOpen: boolean }

export const DEFAULT_VIEW: GoalViewState = { collapsed: [], doneOpen: false }

export function parseGoalView(raw: unknown): GoalViewState {
  const value = (raw && typeof raw === "object" ? raw : {}) as { collapsed?: unknown; doneOpen?: unknown }
  return {
    collapsed: Array.isArray(value.collapsed) ? [...new Set(value.collapsed.filter((id): id is string => typeof id === "string"))] : [],
    doneOpen: value.doneOpen === true,
  }
}

export const isCollapsed = (view: GoalViewState, id: string) => view.collapsed.includes(id)

export function toggleCollapsed(view: GoalViewState, id: string): GoalViewState {
  return { ...view, collapsed: isCollapsed(view, id) ? view.collapsed.filter((x) => x !== id) : [...view.collapsed, id] }
}

/** Collapses every given goal, or expands every one of them (other ids in the list, such as deleted goals, are dropped). */
export function setAllCollapsed(view: GoalViewState, ids: string[], collapsed: boolean): GoalViewState {
  return { ...view, collapsed: collapsed ? [...ids] : [] }
}

/** True when every goal in `ids` is collapsed (and there is at least one): the "Expandir todas" state of the button. */
export const allCollapsed = (view: GoalViewState, ids: string[]) => ids.length > 0 && ids.every((id) => isCollapsed(view, id))

export interface GoalViewRepo {
  load(): GoalViewState
  save(view: GoalViewState): void
}

const KEY = "organizzou:metas-view"

export const localGoalViewRepo: GoalViewRepo = {
  load() {
    try {
      return parseGoalView(JSON.parse(localStorage.getItem(KEY) ?? "null"))
    } catch {
      return { ...DEFAULT_VIEW }
    }
  },
  save(view) {
    try {
      localStorage.setItem(KEY, JSON.stringify(parseGoalView(view)))
    } catch {
      // Private mode: the choice just does not survive the visit.
    }
  },
}
