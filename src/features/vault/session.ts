// The unlocked state of the Cofre, in memory only. The key lives in a module variable (never in React state, storage, a cookie or the URL);
// locking drops it together with the decrypted items and takes a pending copy off the clipboard. Browser only.
import "client-only"

import { useEffect, useState, useSyncExternalStore } from "react"

import { clearClipboardNow } from "./clipboard"
import { settingsRepo, type AutoLock } from "./settings"
import type { VaultItem } from "./types"

export { AUTO_LOCK_OPTIONS, type AutoLock } from "./settings"


/** `lockAt` is the moment (ms) the auto-lock timer will lock the vault; null while locked or when it locks on leaving the tab. */
type Snapshot = { status: "locked" | "unlocked"; scope: string | null; items: VaultItem[]; autoLock: AutoLock; lockAt: number | null }

const LOCKED: Snapshot = { status: "locked", scope: null, items: [], autoLock: "5", lockAt: null }

let key: CryptoKey | null = null
let state: Snapshot = LOCKED
let timer: ReturnType<typeof setTimeout> | null = null
let hooked = false
const listeners = new Set<() => void>()

function emit(next: Snapshot) {
  state = next
  listeners.forEach((listener) => listener())
}

const loadAutoLock = (): AutoLock => settingsRepo.load().autoLock

function schedule() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!key || state.autoLock === "hidden") {
    if (state.lockAt !== null) emit({ ...state, lockAt: null })
    return
  }
  const ms = Number(state.autoLock) * 60_000
  timer = setTimeout(lockVault, ms)
  // Only the deadline changes (every touch moves it), so the countdown can follow it.
  emit({ ...state, lockAt: Date.now() + ms })
}

function hook() {
  if (hooked || typeof document === "undefined") return
  hooked = true
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && key && state.autoLock === "hidden") lockVault()
  })
}

export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getSnapshot = () => state
const getServerSnapshot = () => LOCKED

/** The vault's key while it is unlocked, otherwise null. Never put it anywhere but a call into the WebCrypto API. */
export const getKey = () => key

/** Starts an unlocked session for this account's vault. */
export function unlockSession(scope: string, newKey: CryptoKey, items: VaultItem[]) {
  hook()
  key = newKey
  emit({ status: "unlocked", scope, items, autoLock: loadAutoLock(), lockAt: null })
  schedule()
}

/** Locks: the key, the decrypted items and any pending clipboard copy are dropped. */
export function lockVault() {
  if (timer) clearTimeout(timer)
  timer = null
  key = null
  clearClipboardNow()
  emit({ ...LOCKED, autoLock: state.autoLock })
}

/** Replaces the key after a master-password change (the vault stays unlocked). */
export function replaceKey(newKey: CryptoKey) {
  key = newKey
  schedule()
}

export function setItems(update: (items: VaultItem[]) => VaultItem[]) {
  if (state.status !== "unlocked") return
  emit({ ...state, items: update(state.items) })
}

/** Any use of the vault counts as activity: the auto-lock countdown starts again. */
let lastTouch = 0
export function touch() {
  // Typing fires this constantly: the deadline moves at most once a second.
  if (key && Date.now() - lastTouch > 1000) {
    lastTouch = Date.now()
    schedule()
  }
}

export function setAutoLock(value: AutoLock) {
  settingsRepo.save({ autoLock: value })
  emit({ ...state, autoLock: value, lockAt: null })
  schedule()
}

/** Locks the vault when the account's session ends (signing out, an expired session). */
export async function watchAuthSession(): Promise<() => void> {
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) lockVault()
    })
    return () => data.subscription.unsubscribe()
  } catch {
    return () => {}
  }
}

export function useVaultSession(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Seconds left until the auto-lock (null when it locks on leaving the tab, or when the vault is locked). Ticks every second. */
export function useLockCountdown(): number | null {
  const { lockAt } = useVaultSession()
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (lockAt === null) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [lockAt])
  if (lockAt === null) return null
  return Math.max(0, Math.ceil((lockAt - (now || lockAt - 1)) / 1000))
}
