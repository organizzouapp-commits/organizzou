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
 *  - Cofre: only what the screen registered as a quick action, which it does while unlocked; otherwise none (no hint of vault content, no fallback).
 *  - A screen's quick actions win; else its primary action(s) (a split-button menu counts as several); else, and on screens without an add
 *    action, the fallback "Captura rápida" so the old quick-capture entry stays reachable.
 */
export function resolveContextualActions({ pathname, quick, primary }: { pathname: string; quick: RegisteredAction[] | null; primary: { label: string; menu?: RegisteredAction[] } | null }): ContextualAction[] {
  const screen = screenOf(pathname)
  // The Cofre registers its action only while unlocked (this module never touches vault state), so without it there is nothing to show.
  if (screen === "cofre") return quick && quick.length > 0 ? quick.map((action) => ({ ...action, source: "page" as const })) : []
  if (NO_ADD_SCREENS.has(screen)) return [CAPTURE_ACTION]
  const registered: RegisteredAction[] = quick && quick.length > 0 ? quick : primary ? (primary.menu && primary.menu.length > 0 ? primary.menu : [{ id: "primary", label: primary.label }]) : []
  return registered.length > 0 ? registered.map((action) => ({ ...action, source: "page" as const })) : [CAPTURE_ACTION]
}
