import { describe, expect, it } from "vitest"

import { FOLDER_NAME_MAX, validateFolderName } from "./folders"

const folders = [
  { id: "a", name: "Trabalho" },
  { id: "b", name: "Estudos" },
]

describe("validateFolderName", () => {
  it("trims and collapses spaces", () => {
    expect(validateFolderName("  Ideias   boas ", folders)).toEqual({ ok: true, name: "Ideias boas" })
  })
  it("requires a name", () => {
    expect(validateFolderName("   ", folders).ok).toBe(false)
  })
  it("limits the length", () => {
    expect(validateFolderName("x".repeat(FOLDER_NAME_MAX), folders).ok).toBe(true)
    expect(validateFolderName("x".repeat(FOLDER_NAME_MAX + 1), folders).ok).toBe(false)
  })
  it("rejects duplicates ignoring case and accents", () => {
    expect(validateFolderName("trabalho", folders)).toEqual({ ok: false, error: "Já existe uma pasta com esse nome." })
    expect(validateFolderName("ESTÚDOS", folders).ok).toBe(false)
  })
  it("lets a rename keep its own name", () => {
    expect(validateFolderName("trabalho", folders, "a").ok).toBe(true)
    expect(validateFolderName("estudos", folders, "a").ok).toBe(false)
  })
})
