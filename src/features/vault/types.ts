// Mirrors the planned `vault` schema (docs/PLAN-PHASE-0.md §4.2). In production every field below
// except id/folder_id/type is encrypted in the browser and stored as `ciphertext` + `iv`.
export type VaultItemType = "login" | "card" | "document" | "secure_note"

export const VAULT_TYPE_LABELS: Record<VaultItemType, string> = {
  login: "Login",
  card: "Cartão",
  document: "Documento",
  secure_note: "Nota segura",
}

export type VaultFolderRow = { id: string; name: string }

export type VaultItemRow = {
  id: string
  folder_id: string | null
  type: VaultItemType
  /** Decrypted payload. */
  name: string
  /** Ordered label → value pairs shown in the detail view. Secret fields are listed in `secrets`. */
  fields: { label: string; value: string }[]
  secrets: string[]
  /** For logins: the field that holds the password. */
  password?: string
  updated_at: string
}
