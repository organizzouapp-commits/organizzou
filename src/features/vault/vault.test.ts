import { describe, expect, it } from "vitest"

import { WrongPasswordError, fromBase64, toBase64 } from "./crypto"
import { createMemoryRepo } from "./storage"
import type { VaultItem } from "./types"
import { BackupError, FileTooLargeError, VaultExistsError, changePassword, createVault, deleteItem, exportBackup, importBackup, loadItems, parseBackup, readFile, saveItem, unlock } from "./vault"

const PASSWORD = "senha mestra do teste 2026!"
const item = (id: string, over: Partial<VaultItem> = {}): VaultItem => ({ id, type: "login", name: `Item ${id}`, username: "eu@exemplo.com", password: `segredo-${id}`, updated_at: "2026-11-10T10:00:00Z", ...over })

describe("create and unlock", () => {
  it("creates once, unlocks with the password and refuses a second vault or a wrong password", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    expect(key).toBeTruthy()
    await expect(createVault(repo, "outra senha qualquer 1!")).rejects.toBeInstanceOf(VaultExistsError)
    expect(await unlock(repo, PASSWORD)).toBeTruthy()
    await expect(unlock(repo, "errada errada errada 1")).rejects.toBeInstanceOf(WrongPasswordError)
    await expect(unlock(createMemoryRepo(), PASSWORD)).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it("never stores the password or the key, only parameters and ciphertext", async () => {
    const repo = createMemoryRepo()
    await createVault(repo, PASSWORD)
    const snapshot = JSON.stringify(await repo.snapshot())
    expect(snapshot).not.toContain(PASSWORD)
    expect(Object.keys((await repo.loadMeta())!).sort()).toEqual(["check", "created_at", "kdf", "version"])
  })
})

describe("items", () => {
  it("saves encrypted, reads back, and the stored record holds no plaintext", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a", { password: "SENHA-DO-BANCO-123" }))
    const stored = JSON.stringify(await repo.listItems())
    expect(stored).not.toContain("SENHA-DO-BANCO")
    expect(stored).not.toContain("eu@exemplo.com")
    expect((await loadItems(repo, key)).items).toEqual([item("a", { password: "SENHA-DO-BANCO-123" })])
  })

  it("uses a new IV each time an item is saved", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a"))
    const first = (await repo.listItems())[0]
    await saveItem(repo, key, item("a"))
    const second = (await repo.listItems())[0]
    expect(second.iv).not.toBe(first.iv)
    expect(second.ct).not.toBe(first.ct)
  })

  it("edits and deletes", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a"))
    await saveItem(repo, key, item("b"))
    await saveItem(repo, key, item("a", { name: "Renomeado" }))
    expect((await loadItems(repo, key)).items.map((i) => i.name).sort()).toEqual(["Item b", "Renomeado"])
    await deleteItem(repo, "b")
    expect((await loadItems(repo, key)).items.map((i) => i.id)).toEqual(["a"])
  })

  it("reports a tampered record instead of returning it, and keeps the others", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a"))
    await saveItem(repo, key, item("b"))
    const [first] = await repo.listItems()
    const bytes = fromBase64(first.ct)
    bytes[3] ^= 1
    await repo.put({ ...first, ct: toBase64(bytes) })
    const result = await loadItems(repo, key)
    expect(result.corrupt).toEqual([first.id])
    expect(result.items).toHaveLength(1)
  })

  it("does not accept a record copied onto another id", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a"))
    const [record] = await repo.listItems()
    await repo.put({ ...record, id: "other" })
    expect((await loadItems(repo, key)).corrupt).toEqual(["other"])
  })
})

describe("documents", () => {
  it("encrypts the file apart, reads it back, and carries it over an edit that did not touch it", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    const bytes = new Uint8Array([9, 8, 7, 200, 201, 202])
    const doc = item("d", { type: "document", file: { name: "rg.pdf", mime: "application/pdf", size: bytes.length } })
    await saveItem(repo, key, doc, bytes)
    expect(JSON.stringify(await repo.snapshot())).not.toContain(toBase64(bytes))
    expect(Array.from((await readFile(repo, key, "d"))!)).toEqual(Array.from(bytes))
    await saveItem(repo, key, { ...doc, name: "RG (renomeado)" })
    expect(Array.from((await readFile(repo, key, "d"))!)).toEqual(Array.from(bytes))
    await deleteItem(repo, "d")
    expect(await readFile(repo, key, "d")).toBeNull()
  })

  it("refuses a file above the limit", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await expect(saveItem(repo, key, item("d", { type: "document" }), new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(FileTooLargeError)
    expect(await repo.listItems()).toEqual([])
  })
})

describe("change master password", () => {
  it("re-encrypts every item and file under the new password, with new IVs and a new salt", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a"))
    await saveItem(repo, key, item("d", { type: "document", file: { name: "x.bin", mime: "x/y", size: 3 } }), new Uint8Array([1, 2, 3]))
    const before = await repo.snapshot()
    const newKey = await changePassword(repo, key, "uma senha nova e longa 77!")
    const after = await repo.snapshot()
    expect(after.meta!.kdf.salt).not.toBe(before.meta!.kdf.salt)
    expect(after.items[0].iv).not.toBe(before.items[0].iv)
    await expect(unlock(repo, PASSWORD)).rejects.toBeInstanceOf(WrongPasswordError)
    const reopened = await unlock(repo, "uma senha nova e longa 77!")
    expect((await loadItems(repo, reopened)).items.map((i) => i.id).sort()).toEqual(["a", "d"])
    expect(Array.from((await readFile(repo, newKey, "d"))!)).toEqual([1, 2, 3])
  })

  it("keeps the old vault intact when a record cannot be decrypted", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a"))
    await saveItem(repo, key, item("b"))
    const before = JSON.stringify(await repo.snapshot())
    const [first] = await repo.listItems()
    const bytes = fromBase64(first.ct)
    bytes[0] ^= 1
    await repo.put({ ...first, ct: toBase64(bytes) })
    const damaged = JSON.stringify(await repo.snapshot())
    await expect(changePassword(repo, key, "uma senha nova e longa 77!")).rejects.toBeTruthy()
    expect(JSON.stringify(await repo.snapshot())).toBe(damaged)
    expect(damaged).not.toBe(before)
    expect(await unlock(repo, PASSWORD)).toBeTruthy()
  })

  it("keeps the old vault intact when the write fails", async () => {
    const repo = createMemoryRepo()
    const key = await createVault(repo, PASSWORD)
    await saveItem(repo, key, item("a"))
    const before = JSON.stringify(await repo.snapshot())
    repo.failNextWrite()
    await expect(changePassword(repo, key, "uma senha nova e longa 77!")).rejects.toThrow()
    expect(JSON.stringify(await repo.snapshot())).toBe(before)
    expect(await unlock(repo, PASSWORD)).toBeTruthy()
  })
})

describe("backup", () => {
  it("exports only ciphertext and imports into a fresh vault with the same password", async () => {
    const source = createMemoryRepo()
    const key = await createVault(source, PASSWORD)
    await saveItem(source, key, item("a", { password: "NAO-VAZAR-123" }))
    const text = await exportBackup(source)
    expect(text).not.toContain("NAO-VAZAR")
    expect(text).not.toContain(PASSWORD)
    const target = createMemoryRepo()
    const imported = await importBackup(target, parseBackup(text), PASSWORD)
    expect((await loadItems(target, imported)).items[0].password).toBe("NAO-VAZAR-123")
    expect(await unlock(target, PASSWORD)).toBeTruthy()
  })

  it("rejects what is not a backup before touching anything", () => {
    for (const text of ["", "não é json", "{}", JSON.stringify({ format: "outro" }), JSON.stringify({ format: "organizzou-vault-backup", version: 1 })]) {
      expect(() => parseBackup(text)).toThrow(BackupError)
    }
  })

  it("rejects a backup that asks for a weak key derivation", async () => {
    const source = createMemoryRepo()
    await createVault(source, PASSWORD)
    const backup = JSON.parse(await exportBackup(source))
    backup.meta.kdf.iterations = 1000
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(BackupError)
  })

  it("leaves the current vault untouched on a wrong password or a damaged record", async () => {
    const source = createMemoryRepo()
    const key = await createVault(source, PASSWORD)
    await saveItem(source, key, item("a"))
    const backup = JSON.parse(await exportBackup(source))

    const target = createMemoryRepo()
    const targetKey = await createVault(target, "a senha do cofre atual 55!")
    await saveItem(target, targetKey, item("keep"))
    const before = JSON.stringify(await target.snapshot())

    await expect(importBackup(target, parseBackup(JSON.stringify(backup)), "senha errada errada 3!")).rejects.toBeInstanceOf(WrongPasswordError)
    expect(JSON.stringify(await target.snapshot())).toBe(before)

    const bytes = fromBase64(backup.items[0].ct)
    bytes[0] ^= 1
    backup.items[0].ct = toBase64(bytes)
    await expect(importBackup(target, parseBackup(JSON.stringify(backup)), PASSWORD)).rejects.toBeInstanceOf(BackupError)
    expect(JSON.stringify(await target.snapshot())).toBe(before)
  })
})
