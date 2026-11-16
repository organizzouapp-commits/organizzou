import { describe, expect, it } from "vitest"

import { friendlySaveError, isMissingColumn, isMissingTable } from "./save-errors"

describe("save errors", () => {
  it("recognises a column or a table that a prepared migration has not created yet", () => {
    expect(isMissingColumn({ code: "42703", message: 'column "kind" of relation "life_goals" does not exist' })).toBe(true)
    expect(isMissingColumn({ code: "PGRST204", message: "Could not find the 'kind' column of 'life_goals' in the schema cache" })).toBe(true)
    expect(isMissingColumn({ code: "23505", message: "duplicate key" })).toBe(false)
    expect(isMissingTable({ code: "42P01", message: 'relation "user_meals" does not exist' })).toBe(true)
    expect(isMissingTable({ code: "PGRST205" })).toBe(true)
    expect(isMissingTable(null)).toBe(false)
  })
  it("never shows the raw database text; the goal dates constraint becomes the form message", () => {
    expect(friendlySaveError({ code: "23514", message: 'new row for relation "finance_goals" violates check constraint "finance_goals_dates_check"' })).toBe("O prazo final precisa ser depois da data de início.")
    expect(friendlySaveError({ code: "42501", message: "permission denied" })).toBe("Sem permissão para salvar isso.")
    expect(friendlySaveError({ code: "XX000", message: "internal secret detail" })).toBe("Não foi possível salvar.")
    expect(friendlySaveError({ code: "42P01", message: "relation x does not exist" })).toMatch(/ainda não está disponível/)
  })
})
