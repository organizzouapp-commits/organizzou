import { GOAL_DATES_MESSAGE } from "@/features/finance/goal-schedule"

export type DbError = { code?: string | null; message?: string | null; details?: string | null } | null | undefined

/** The database does not have the column: its migration is prepared but not applied yet (Postgres 42703, PostgREST PGRST204). */
export function isMissingColumn(error: DbError): boolean {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? "")
}

/** The database does not have the table (42P01, PostgREST PGRST205). */
export function isMissingTable(error: DbError): boolean {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST205") return true
  return /relation .* does not exist|could not find the table/i.test(error.message ?? "")
}

/** A friendly pt-BR sentence for a failed save, never the raw database text. */
export function friendlySaveError(error: DbError): string {
  if (!error) return "Não foi possível salvar."
  if (error.code === "42501") return "Sem permissão para salvar isso."
  if (error.code === "23514" && /finance_goals_dates_check/.test(`${error.message ?? ""} ${error.details ?? ""}`)) return GOAL_DATES_MESSAGE
  if (isMissingTable(error)) return "Isto ainda não está disponível nesta versão do banco. Seus dados ficam neste aparelho."
  return "Não foi possível salvar."
}
