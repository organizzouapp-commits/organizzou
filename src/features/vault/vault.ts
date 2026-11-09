// The operations of the Cofre on top of crypto.ts and a VaultRepo: create, unlock, read, save, delete, change the master password,
// export and import an encrypted backup. Pure with respect to the DOM; it never logs, never calls the network and never stores a key.
import { z } from "zod"

import { DecryptError, KDF_PARAMS, MIN_KDF_ITERATIONS, WrongPasswordError, decryptBytes, decryptJson, encryptBytes, encryptJson, fromBase64, keyFromMeta, makeCheck, newKey, toBase64, verifyCheck } from "./crypto"
import type { StoredFile, StoredItem, VaultMeta, VaultRepo, VaultSnapshot } from "./storage"
import { MAX_FILE_BYTES, type VaultItem } from "./types"

export class VaultExistsError extends Error {
  constructor() {
    super("vault-exists")
    this.name = "VaultExistsError"
  }
}
export class FileTooLargeError extends Error {
  constructor() {
    super("file-too-large")
    this.name = "FileTooLargeError"
  }
}
export class BackupError extends Error {
  constructor(message = "invalid-backup") {
    super(message)
    this.name = "BackupError"
  }
}

const itemAad = (id: string) => `item:${id}`
const fileAad = (id: string) => `file:${id}`

export const isInitialized = async (repo: VaultRepo) => (await repo.loadMeta()) !== null

/** Creates the vault with a master password and returns its key (the caller keeps it in memory). Never overwrites an existing vault. */
export async function createVault(repo: VaultRepo, password: string): Promise<CryptoKey> {
  if (await isInitialized(repo)) throw new VaultExistsError()
  const { key, kdf } = await newKey(password)
  const meta: VaultMeta = { version: 1, kdf, check: await makeCheck(key), created_at: new Date().toISOString() }
  await repo.replaceAll({ meta, items: [], files: [] })
  return key
}

/** The key of the vault for a password. A wrong password and a damaged vault give the same error, so nothing tells which part was wrong. */
export async function unlock(repo: VaultRepo, password: string): Promise<CryptoKey> {
  const meta = await repo.loadMeta()
  if (!meta) throw new WrongPasswordError()
  let key: CryptoKey
  try {
    key = await keyFromMeta(password, meta.kdf)
  } catch {
    throw new WrongPasswordError()
  }
  if (!(await verifyCheck(key, meta.check))) throw new WrongPasswordError()
  return key
}

/** Every item decrypted; one that fails authentication (damaged or tampered) is left out and its id is reported. */
export async function loadItems(repo: VaultRepo, key: CryptoKey): Promise<{ items: VaultItem[]; corrupt: string[] }> {
  const stored = await repo.listItems()
  const items: VaultItem[] = []
  const corrupt: string[] = []
  for (const record of stored) {
    try {
      const item = await decryptJson<VaultItem>(key, record, itemAad(record.id))
      if (item.id !== record.id) throw new DecryptError()
      items.push(item)
    } catch {
      corrupt.push(record.id)
    }
  }
  return { items, corrupt }
}

/** Encrypts and saves an item (and, for a document, the bytes of its file) with a fresh IV each time. */
export async function saveItem(repo: VaultRepo, key: CryptoKey, item: VaultItem, file?: Uint8Array | null): Promise<void> {
  if (file && file.byteLength > MAX_FILE_BYTES) throw new FileTooLargeError()
  const record: StoredItem = { id: item.id, v: 1, ...(await encryptJson(key, item, itemAad(item.id))) }
  let stored: StoredFile | null = null
  if (file) {
    const { iv, ct } = await encryptBytes(key, file, fileAad(item.id))
    stored = { id: item.id, v: 1, iv: toBase64(iv), ct: toBase64(ct) }
  } else if (item.file) {
    // The item keeps its file (an edit that did not touch it): carry the stored encrypted bytes over.
    stored = (await repo.getFile(item.id)) ?? null
  }
  await repo.put(record, stored)
}

export const deleteItem = (repo: VaultRepo, id: string) => repo.remove(id)

/** The decrypted bytes of a document's file; null when the item has none. */
export async function readFile(repo: VaultRepo, key: CryptoKey, id: string): Promise<Uint8Array | null> {
  const stored = await repo.getFile(id)
  if (!stored) return null
  return decryptBytes(key, fromBase64(stored.iv), fromBase64(stored.ct), fileAad(id))
}

/**
 * Changes the master password. Everything is decrypted with the current key and encrypted again with a key from the new password
 * (a new salt, new IVs), all in memory first; only when every record went through is the vault replaced, in one atomic write. On any
 * failure nothing is written and the old vault (and password) stay exactly as they were. Returns the new key.
 */
export async function changePassword(repo: VaultRepo, currentKey: CryptoKey, newPassword: string): Promise<CryptoKey> {
  const snapshot = await repo.snapshot()
  if (!snapshot.meta) throw new WrongPasswordError()
  const { key, kdf } = await newKey(newPassword)
  const items: StoredItem[] = []
  for (const record of snapshot.items) {
    const item = await decryptJson<VaultItem>(currentKey, record, itemAad(record.id))
    items.push({ id: record.id, v: 1, ...(await encryptJson(key, item, itemAad(record.id))) })
  }
  const files: StoredFile[] = []
  for (const record of snapshot.files) {
    const bytes = await decryptBytes(currentKey, fromBase64(record.iv), fromBase64(record.ct), fileAad(record.id))
    const { iv, ct } = await encryptBytes(key, bytes, fileAad(record.id))
    files.push({ id: record.id, v: 1, iv: toBase64(iv), ct: toBase64(ct) })
  }
  const meta: VaultMeta = { version: 1, kdf, check: await makeCheck(key), created_at: snapshot.meta.created_at }
  await repo.replaceAll({ meta, items, files })
  return key
}

// ------------------------------------------------------------------ backup

export const BACKUP_FORMAT = "organizzou-vault-backup"

const cipherSchema = z.object({ iv: z.string().min(1), ct: z.string().min(1) })
const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exported_at: z.string(),
  meta: z.object({
    version: z.literal(1),
    kdf: z.object({ name: z.literal("PBKDF2"), hash: z.literal("SHA-256"), iterations: z.number().int().min(MIN_KDF_ITERATIONS).max(10_000_000), salt: z.string().min(1) }),
    check: cipherSchema,
    created_at: z.string(),
  }),
  items: z.array(z.object({ id: z.string().min(1), v: z.literal(1) }).and(cipherSchema)),
  files: z.array(z.object({ id: z.string().min(1), v: z.literal(1) }).and(cipherSchema)),
})
export type VaultBackup = z.infer<typeof backupSchema>

/** The encrypted backup as text: the stored ciphertext as it is, so it opens only with the master password of the moment it was made. Never plaintext. */
export async function exportBackup(repo: VaultRepo): Promise<string> {
  const snapshot = await repo.snapshot()
  if (!snapshot.meta) throw new BackupError("no-vault")
  const backup: VaultBackup = { format: BACKUP_FORMAT, version: 1, exported_at: new Date().toISOString(), meta: snapshot.meta, items: snapshot.items, files: snapshot.files }
  return JSON.stringify(backup)
}

/** Reads and validates a backup file's text (shape, parameters, sizes); throws BackupError when it is not a valid backup. */
export function parseBackup(text: string): VaultBackup {
  if (text.length > 40 * 1024 * 1024) throw new BackupError("too-large")
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError()
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) throw new BackupError()
  return parsed.data
}

/**
 * Replaces the vault with a backup. First the backup is proved with its own password (the verification blob and every item and file must
 * decrypt); only then is the vault overwritten, atomically. A wrong password or any damaged record leaves the current vault untouched.
 * Returns the key of the imported vault.
 */
export async function importBackup(repo: VaultRepo, backup: VaultBackup, password: string): Promise<CryptoKey> {
  let key: CryptoKey
  try {
    key = await keyFromMeta(password, backup.meta.kdf)
  } catch {
    throw new WrongPasswordError()
  }
  if (!(await verifyCheck(key, backup.meta.check))) throw new WrongPasswordError()
  const ids = new Set<string>()
  for (const record of backup.items) {
    if (ids.has(record.id)) throw new BackupError()
    ids.add(record.id)
    try {
      const item = await decryptJson<VaultItem>(key, record, itemAad(record.id))
      if (item.id !== record.id) throw new DecryptError()
    } catch {
      throw new BackupError("damaged-record")
    }
  }
  for (const record of backup.files) {
    if (!ids.has(record.id)) throw new BackupError()
    try {
      await decryptBytes(key, fromBase64(record.iv), fromBase64(record.ct), fileAad(record.id))
    } catch {
      throw new BackupError("damaged-record")
    }
  }
  const snapshot: VaultSnapshot = { meta: backup.meta, items: backup.items, files: backup.files }
  await repo.replaceAll(snapshot)
  return key
}

export { KDF_PARAMS }
