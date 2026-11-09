// Where the Cofre keeps its (already encrypted) records. Only ciphertext goes through here: never the master password, a key or plaintext.
// The vault logic talks to the VaultRepo interface, so the browser's IndexedDB can later be replaced or joined by a Supabase-backed adapter
// without touching the cryptography or the screens.
import type { Cipher, KdfMeta } from "./crypto"

export type VaultMeta = { version: 1; kdf: KdfMeta; check: Cipher; created_at: string }
/** One item: its encrypted payload (name, fields, type…) under the item's id. */
export type StoredItem = { id: string; v: 1; iv: string; ct: string }
/** The encrypted bytes of a document's file, under the item's id. */
export type StoredFile = { id: string; v: 1; iv: string; ct: string }
export type VaultSnapshot = { meta: VaultMeta | null; items: StoredItem[]; files: StoredFile[] }

export interface VaultRepo {
  loadMeta(): Promise<VaultMeta | null>
  listItems(): Promise<StoredItem[]>
  getFile(id: string): Promise<StoredFile | undefined>
  /** Saves an item (and its file) together: both or neither. */
  put(item: StoredItem, file?: StoredFile | null): Promise<void>
  remove(id: string): Promise<void>
  snapshot(): Promise<VaultSnapshot>
  /** Replaces the whole vault in one all-or-nothing step: on any failure the previous contents stay exactly as they were. */
  replaceAll(snapshot: VaultSnapshot): Promise<void>
}

// ------------------------------------------------------------------ in memory (tests, and the shape every adapter must keep)

export function createMemoryRepo(initial?: VaultSnapshot): VaultRepo & { failNextWrite(): void } {
  let meta: VaultMeta | null = initial?.meta ?? null
  const items = new Map((initial?.items ?? []).map((i) => [i.id, i]))
  const files = new Map((initial?.files ?? []).map((f) => [f.id, f]))
  let failing = false
  const guard = () => {
    if (failing) {
      failing = false
      throw new Error("write failed")
    }
  }
  return {
    failNextWrite: () => {
      failing = true
    },
    async loadMeta() {
      return meta
    },
    async listItems() {
      return [...items.values()]
    },
    async getFile(id) {
      return files.get(id)
    },
    async put(item, file) {
      guard()
      items.set(item.id, item)
      if (file) files.set(file.id, file)
      else files.delete(item.id)
    },
    async remove(id) {
      guard()
      items.delete(id)
      files.delete(id)
    },
    async snapshot() {
      return { meta, items: [...items.values()], files: [...files.values()] }
    },
    async replaceAll(snapshot) {
      guard()
      // Build the new state first, then swap: nothing is half-written.
      const nextItems = new Map(snapshot.items.map((i) => [i.id, i]))
      const nextFiles = new Map(snapshot.files.map((f) => [f.id, f]))
      meta = snapshot.meta
      items.clear()
      files.clear()
      nextItems.forEach((v, k) => items.set(k, v))
      nextFiles.forEach((v, k) => files.set(k, v))
    },
  }
}

// ------------------------------------------------------------------ IndexedDB (the browser)

const META_KEY = "meta"

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("aborted"))
  })
}

/** True when this browser can keep the vault (IndexedDB can be missing or blocked, for instance in some private windows). */
export function storageAvailable(): boolean {
  return typeof indexedDB !== "undefined"
}

/** The vault of one person in this browser. `scope` (the account id, which is not a secret) keeps two accounts of the same browser apart. */
export function createIndexedDbRepo(scope: string): VaultRepo {
  let opened: Promise<IDBDatabase> | null = null
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(`organizzou-vault:${scope}`, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        db.createObjectStore("meta")
        db.createObjectStore("items", { keyPath: "id" })
        db.createObjectStore("files", { keyPath: "id" })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error("blocked"))
    }))

  return {
    async loadMeta() {
      const db = await open()
      return ((await request(db.transaction("meta").objectStore("meta").get(META_KEY))) as VaultMeta | undefined) ?? null
    },
    async listItems() {
      const db = await open()
      return (await request(db.transaction("items").objectStore("items").getAll())) as StoredItem[]
    },
    async getFile(id) {
      const db = await open()
      return (await request(db.transaction("files").objectStore("files").get(id))) as StoredFile | undefined
    },
    async put(item, file) {
      const db = await open()
      const tx = db.transaction(["items", "files"], "readwrite")
      tx.objectStore("items").put(item)
      if (file) tx.objectStore("files").put(file)
      else tx.objectStore("files").delete(item.id)
      await done(tx)
    },
    async remove(id) {
      const db = await open()
      const tx = db.transaction(["items", "files"], "readwrite")
      tx.objectStore("items").delete(id)
      tx.objectStore("files").delete(id)
      await done(tx)
    },
    async snapshot() {
      const db = await open()
      const tx = db.transaction(["meta", "items", "files"])
      const [meta, items, files] = await Promise.all([request(tx.objectStore("meta").get(META_KEY)), request(tx.objectStore("items").getAll()), request(tx.objectStore("files").getAll())])
      return { meta: (meta as VaultMeta | undefined) ?? null, items: items as StoredItem[], files: files as StoredFile[] }
    },
    async replaceAll(snapshot) {
      const db = await open()
      // One transaction: if anything throws, the transaction aborts and the old contents are untouched.
      const tx = db.transaction(["meta", "items", "files"], "readwrite")
      const finished = done(tx)
      try {
        tx.objectStore("items").clear()
        tx.objectStore("files").clear()
        if (snapshot.meta) tx.objectStore("meta").put(snapshot.meta, META_KEY)
        else tx.objectStore("meta").delete(META_KEY)
        snapshot.items.forEach((item) => tx.objectStore("items").put(item))
        snapshot.files.forEach((file) => tx.objectStore("files").put(file))
      } catch (error) {
        tx.abort()
        await finished.catch(() => undefined)
        throw error
      }
      await finished
    },
  }
}
