// The timing rules of the Cofre's automatic lock, apart from the browser: how long each setting waits, whether it locks when the tab is
// hidden, and a timer that restarts on activity (at most once a second, since typing is constant activity). Pure and testable.
import type { AutoLock } from "./settings"

/** How long the vault stays open without activity, in ms; null when the setting does not use a timer ("Ao fechar a aba"). */
export function lockDelayMs(setting: AutoLock): number | null {
  return setting === "hidden" ? null : Number(setting) * 60_000
}

/** "Ao fechar a aba" locks the moment the tab is hidden. */
export const locksOnHide = (setting: AutoLock): boolean => setting === "hidden"

export type LockTimer = {
  /** (Re)starts the countdown for this setting. */
  start(setting: AutoLock): void
  /** Activity: moves the deadline, at most once per `throttleMs`. */
  touch(): void
  /** Stops the countdown without calling `onLock`. */
  stop(): void
  /** The moment (ms since epoch) the vault will lock, or null. */
  deadline(): number | null
}

export function createLockTimer(onLock: () => void, onDeadline: (deadline: number | null) => void, throttleMs = ACTIVITY_THROTTLE_MS): LockTimer {
  let handle: ReturnType<typeof setTimeout> | null = null
  let setting: AutoLock | null = null
  let deadline: number | null = null
  let lastMove = 0

  const clear = () => {
    if (handle) clearTimeout(handle)
    handle = null
  }

  function start(next: AutoLock) {
    clear()
    setting = next
    const ms = lockDelayMs(next)
    if (ms === null) {
      deadline = null
      onDeadline(null)
      return
    }
    lastMove = Date.now()
    deadline = lastMove + ms
    handle = setTimeout(() => {
      handle = null
      deadline = null
      onLock()
    }, ms)
    onDeadline(deadline)
  }

  return {
    start,
    touch() {
      if (setting === null || deadline === null) return
      if (Date.now() - lastMove > throttleMs) start(setting)
    },
    stop() {
      clear()
      setting = null
      deadline = null
    },
    deadline: () => deadline,
  }
}

// ---------------------------------------------------------------- absolute deadline helpers (timestamps, never tick counts)

/** Activity inside the vault moves the deadline at most this often. */
export const ACTIVITY_THROTTLE_MS = 5000

/** Milliseconds until the vault locks (0 once the deadline has passed); null when there is no deadline. */
export function getRemainingMs(lockAt: number | null, now: number): number | null {
  return lockAt === null ? null : Math.max(0, lockAt - now)
}

/** True once the deadline has passed: used on every tick and when the page comes back to the foreground (a sleeping tab keeps no timer). */
export function shouldLock(lockAt: number | null, now: number): boolean {
  return lockAt !== null && now >= lockAt
}

/**
 * Real activity inside the vault (copy, reveal, edit, search, generate…) pushes the deadline to now + delay, but only if the last push was at
 * least `throttleMs` ago. Anything else (switching tabs, navigating) never calls this, so it never extends or resets the countdown.
 */
export function extendOnActivity({ lockAt, lastExtendAt, now, delayMs, throttleMs = ACTIVITY_THROTTLE_MS }: { lockAt: number | null; lastExtendAt: number; now: number; delayMs: number | null; throttleMs?: number }): { lockAt: number | null; lastExtendAt: number; extended: boolean } {
  if (lockAt === null || delayMs === null || shouldLock(lockAt, now) || now - lastExtendAt < throttleMs) return { lockAt, lastExtendAt, extended: false }
  return { lockAt: now + delayMs, lastExtendAt: now, extended: true }
}
