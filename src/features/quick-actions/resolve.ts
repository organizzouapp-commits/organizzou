// Which "add" actions the quick-actions button offers on a screen. Pure: the screens register what they can do (the same handlers as their
// header button), and this decides what is shown for the current route, including the Cofre rule and the fallback.

/** What a screen registered: an id (to find its handler again) and the label shown on the button. */
export type RegisteredAction = { id: string; label: string }

/** `page` actions run the screen's own handler; `capture` is the fallback that opens the quick capture. */
export type ContextualAction = RegisteredAction & { source: "page" | "capture" }

export const CAPTURE_ACTION: ContextualAction = { id: "capture", label: "Captura rápida", source: "capture" }

/** The first path segment after /dashboard ("" for Hoje). */
export function screenOf(pathname: string): string {
  const match = /^\/dashboard(?:\/([^/?#]+))?/.exec(pathname)
  return match?.[1] ?? ""
}

/** Screens that never offer an add action of their own (anything they might have registered is ignored). */
const NO_ADD_SCREENS = new Set(["configuracoes", "ajuda"])

/**
 * The contextual actions for the current route, closest to the button first.
 *  - Cofre while locked: none (the button never hints at vault content, and there is no fallback there either).
 *  - A screen's quick actions win; else its primary action(s) (a split-button menu counts as several); else, and on screens without an add
 *    action, the fallback "Captura rápida" so the old quick-capture entry stays reachable.
 */
export function resolveContextualActions({ pathname, quick, primary, vaultLocked }: { pathname: string; quick: RegisteredAction[] | null; primary: { label: string; menu?: RegisteredAction[] } | null; vaultLocked: boolean }): ContextualAction[] {
  const screen = screenOf(pathname)
  if (screen === "cofre" && vaultLocked) return []
  if (NO_ADD_SCREENS.has(screen)) return [CAPTURE_ACTION]
  const registered: RegisteredAction[] = quick && quick.length > 0 ? quick : primary ? (primary.menu && primary.menu.length > 0 ? primary.menu : [{ id: "primary", label: primary.label }]) : []
  return registered.length > 0 ? registered.map((action) => ({ ...action, source: "page" as const })) : [CAPTURE_ACTION]
}
