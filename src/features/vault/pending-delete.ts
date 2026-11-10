// "Excluir" with "Desfazer": an item is taken out of the screen at once but only erased from the store when the undo window closes. Until then
// it exists only in memory here, so undoing puts it back untouched. Pure bookkeeping: the caller supplies what "erase" does.
import type { VaultItem } from "./types"

type Entry = { item: VaultItem; erase: () => Promise<void> | void }
const pending = new Map<string, Entry>()

/** Starts a soft delete: remembers the item and how to erase it for good. */
export function startDelete(item: VaultItem, erase: Entry["erase"]) {
  pending.set(item.id, { item, erase })
}

/** Undo: returns the item to put back, or null when it was already erased. */
export function undoDelete(id: string): VaultItem | null {
  const entry = pending.get(id)
  if (!entry) return null
  pending.delete(id)
  return entry.item
}

/** The window closed: erases the item for good. Does nothing if it was undone. */
export async function commitDelete(id: string): Promise<void> {
  const entry = pending.get(id)
  if (!entry) return
  pending.delete(id)
  await entry.erase()
}

/** Erases every pending item now (locking the vault, exporting a backup). */
export async function flushPendingDeletes(): Promise<void> {
  await Promise.all([...pending.keys()].map(commitDelete))
}

export const hasPendingDelete = (id: string) => pending.has(id)
