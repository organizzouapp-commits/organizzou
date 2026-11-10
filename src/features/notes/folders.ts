// Folder-name rules for the "Nova pasta" / "Renomear pasta" dialog. Pure, so the dialog and the tests share them.
export const FOLDER_NAME_MAX = 40

export type FolderNameResult = { ok: true; name: string } | { ok: false; error: string }

/** Trims the name, then checks it is present, within the limit and not a duplicate (case and accents ignored). `ignoreId` lets a rename keep its own name. */
export function validateFolderName(raw: string, folders: { id: string; name: string }[], ignoreId?: string): FolderNameResult {
  const name = raw.trim().replace(/\s+/g, " ")
  if (name === "") return { ok: false, error: "Dê um nome à pasta." }
  if (name.length > FOLDER_NAME_MAX) return { ok: false, error: `Use no máximo ${FOLDER_NAME_MAX} caracteres.` }
  const key = fold(name)
  if (folders.some((f) => f.id !== ignoreId && fold(f.name) === key)) return { ok: false, error: "Já existe uma pasta com esse nome." }
  return { ok: true, name }
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
