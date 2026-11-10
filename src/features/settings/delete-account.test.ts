import { describe, expect, it } from "vitest"

import { isDeleteConfirmation } from "./delete-account"

describe("isDeleteConfirmation", () => {
  it("accepts the exact word, ignoring surrounding spaces", () => {
    expect(isDeleteConfirmation("EXCLUIR")).toBe(true)
    expect(isDeleteConfirmation("  EXCLUIR ")).toBe(true)
  })

  it("rejects anything else", () => {
    for (const bad of ["", "excluir", "Excluir", "EXCLUI", "EXCLUIR conta", "EXCLUIR\nX"]) expect(isDeleteConfirmation(bad)).toBe(false)
  })
})
