// The Cofre (vault). Everything here runs in the browser: the master password and the keys never leave it, and the only thing that is
// stored is ciphertext (see crypto.ts and storage.ts). Nothing of this is read by the server, the assistant or any analytics.
export type VaultItemType = "login" | "card" | "document" | "secure_note"

export const VAULT_TYPES: VaultItemType[] = ["login", "card", "document", "secure_note"]

export const VAULT_TYPE_LABELS: Record<VaultItemType, string> = {
  login: "Senha",
  card: "Cartão",
  document: "Documento",
  secure_note: "Nota segura",
}

/** A file attached to a document. Its bytes are encrypted and stored apart; only these details live in the item's own ciphertext. */
export type VaultFileInfo = { name: string; mime: string; size: number }

/** One item as the person sees it (decrypted, in memory while the vault is unlocked). */
export type VaultItem = {
  id: string
  type: VaultItemType
  name: string
  // login
  username?: string
  password?: string
  url?: string
  // card
  holder?: string
  number?: string
  expiry?: string
  cvv?: string
  // secure note
  text?: string
  // any type
  notes?: string
  // document
  file?: VaultFileInfo
  updated_at: string
  /** When the item was first saved (older items do not have it). */
  created_at?: string
  /** The last time a value of this item was copied. */
  copied_at?: string
}

/** The largest file a document can hold (it is encrypted in memory and kept in the browser's storage). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024
