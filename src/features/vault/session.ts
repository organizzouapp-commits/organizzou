// The unlocked state of the Cofre, in memory only. The key lives in a module variable (never in React state, storage, a cookie or the URL);
// locking drops it together with the decrypted items and takes a pending copy off the clipboard. Browser only.
import "client-only"

import { useSyncExternalStore } from "react"

import { clearClipboardNow } from "./clipboard"
import type { VaultItem } from "./types"

export type AutoLock = "1" | "5" | "15" | "hidden"
export const AUTO_LOCK_OPTIONS: { value: AutoLock; label: string }[] = [
  { value: "1", label: "Após 1 minuto" },
  { value: "5", label: "Após 5 minutos" },
  { value: "15", label: "Após 15 minutos" },
  { value: "hidden", label: "Ao sair da aba" },
]

type Snapshot = { status: "locked" | "unlocked"; scope: string | null; items: VaultItem[]; autoLock: AutoLock }

const SETTINGS_KEY = "organizzou:cofre-settings"
const LOCKED: Snapshot = { status: "locked", scope: null, items: [], autoLock: "5" }

let key: CryptoKey | null = null
let state: Snapshot = LOCKED
let timer: ReturnType<typeof setTimeout> | null = null
let hooked = false
const listeners = new Set<() => void>()

function emit(next: Snapshot) {
  state = next
  listeners.forEach((listener) => listener())
}

function loadAutoLock(): AutoLock {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").autoLock
    return value === "1" || value === "5" || value === "15" || value === "hidden" ? value : "5"
  } catch {
    return "5"
  }
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!key || state.autoLock === "hidden") return
  timer = setTimeout(lockVault, Number(state.autoLock) * 60_000)
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
  emit({ status: "unlocked", scope, items, autoLock: loadAutoLock() })
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
export function touch() {
  if (key) schedule()
}

export function setAutoLock(value: AutoLock) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autoLock: value }))
  } catch {
    // Private mode: the choice just does not survive the visit.
  }
  emit({ ...state, autoLock: value })
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
