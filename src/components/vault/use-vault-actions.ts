"use client"

import { toast } from "sonner"

import { useVaultRepo } from "@/components/vault/vault-kit"
import { CLIPBOARD_CLEAR_MS, copySecret } from "@/features/vault/clipboard"
import { getKey, setItems, touch } from "@/features/vault/session"
import type { VaultItem } from "@/features/vault/types"
import { deleteItem, readFile, saveItem } from "@/features/vault/vault"

/** What the screens do with the vault while it is unlocked. Every call uses the in-memory key and counts as activity for the auto-lock. */
export function useVaultActions() {
  const { repo } = useVaultRepo()

  async function save(item: VaultItem, file?: Uint8Array | null) {
    const key = getKey()
    if (!key) throw new Error("locked")
    await saveItem(repo, key, item, file)
    setItems((items) => [...items.filter((i) => i.id !== item.id), item])
    touch()
  }

  async function remove(id: string) {
    await deleteItem(repo, id)
    setItems((items) => items.filter((i) => i.id !== id))
    touch()
  }

  /** Decrypts a document's file and either downloads it or opens it in a new tab. The object URL is released soon after. */
  async function openFile(item: VaultItem, mode: "download" | "open") {
    const key = getKey()
    if (!key || !item.file) return
    touch()
    const bytes = await readFile(repo, key, item.id)
    if (!bytes) {
      toast("Esse documento não tem arquivo guardado.")
      return
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: item.file.mime || "application/octet-stream" }))
    if (mode === "open") {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      const link = document.createElement("a")
      link.href = url
      link.download = item.file.name
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  /**
   * Copies a value and says so ("Senha copiada. Limpa em 30 s."); 30 seconds later the clipboard is emptied, only if it still holds the copied
   * value. When an item is given, its last-copy time is remembered (inside its own encrypted record).
   */
  async function copy(text: string, message: string, item?: VaultItem) {
    touch()
    try {
      await copySecret(text)
      toast.success(`${message}. Limpa em ${CLIPBOARD_CLEAR_MS / 1000} s.`)
      if (item) await save({ ...item, copied_at: new Date().toISOString() })
    } catch {
      toast("Não consegui copiar. Selecione o texto e copie à mão.")
    }
  }

  return { save, remove, openFile, copy }
}
