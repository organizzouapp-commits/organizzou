// "Exportar meus dados": which tables go in the export and how a row becomes a CSV line. Pure, so the Excel-for-Brazil rules are tested.

/** The module tables a person owns, by module. Every one is read with the person's own session, so RLS decides what comes back. */
export const EXPORT_MODULES: { module: string; label: string; tables: string[] }[] = [
  { module: "perfil", label: "Perfil e configurações", tables: ["profiles", "notification_preferences"] },
  { module: "tarefas", label: "Tarefas", tables: ["boards", "board_lists", "tasks", "tags", "task_tags", "task_checklist_items", "task_comments", "attachments", "task_priorities", "task_category_colors"] },
  { module: "agenda", label: "Agenda", tables: ["events"] },
  { module: "financas", label: "Finanças", tables: ["finance_accounts", "finance_categories", "finance_transactions", "finance_bills", "finance_goals"] },
  { module: "rotina", label: "Rotina", tables: ["habits", "habit_logs"] },
  { module: "treinos", label: "Treinos", tables: ["exercises", "workout_plans", "plan_exercises", "workout_sessions", "set_logs"] },
  { module: "dieta", label: "Dieta", tables: ["foods", "meal_items", "diet_goals", "weight_logs", "water_logs"] },
  { module: "estudos", label: "Estudos", tables: ["subjects", "study_sessions", "study_deadlines", "flashcard_decks", "flashcards"] },
  { module: "notas", label: "Notas e lembretes", tables: ["note_folders", "notes", "reminders"] },
  { module: "metas", label: "Metas", tables: ["life_goals", "life_goal_links", "life_goal_milestones"] },
  { module: "diario", label: "Diário", tables: ["journal_entries"] },
]

export const EXPORT_SCHEMA_VERSION = 1

/** What the export says about the Cofre: it never leaves the device, so there is nothing of it on the server to export. */
export const VAULT_NOTE = "O Cofre é criptografado neste aparelho e a Organizzou não guarda esse conteúdo. Para levar o Cofre, use a exportação criptografada dentro do próprio Cofre."

/** The profile columns that belong in an export (never anything internal). */
export const PROFILE_COLUMNS = "id, display_name, phone, theme, timezone, locale, created_at, updated_at"

export const exportFilename = (day: string, extension: "json" | "zip") => `organizzou-export-${day}.${extension}`

const MONEY = /_cents$/
const DATE = /(^|_)(date|on|day|at)$/

/** Columns holding money in cents: written as reais with a decimal comma, the way Brazilian Excel reads them. */
export const isMoneyColumn = (name: string) => MONEY.test(name)
/** Columns holding a date or a moment: they get an extra human column next to the ISO one. */
export const isDateColumn = (name: string) => DATE.test(name)

/** 1234567 -> "12345,67" (no thousands dots, so a spreadsheet reads it as a number). */
export const centsToDecimalComma = (cents: number) => (cents / 100).toFixed(2).replace(".", ",")

/** "2026-11-12" or an ISO moment -> "12/11/2026" (São Paulo day for a moment). Anything else is returned as it came. */
export function localizedDate(value: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : null
  if (!day || Number.isNaN(Date.parse(day))) return value
  const [y, m, d] = day.split("-")
  return `${d}/${m}/${y}`
}

/** A CSV cell with ";" as the separator: quoted when it holds a separator, a quote or a line break; spreadsheet formulas are defused. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  let text = typeof value === "object" ? JSON.stringify(value) : String(value)
  // A cell that starts like a formula would run in Excel: a leading apostrophe keeps it plain text.
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text)) text = `'${text}`
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

type Row = Record<string, unknown>

/** The columns of a table in a stable order (the id first), plus a "<name>_local" column after every date. */
export function csvColumns(rows: Row[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key)
  const keys = [...seen].sort((a, b) => (a === "id" ? -1 : b === "id" ? 1 : a.localeCompare(b)))
  return keys.flatMap((key) => (isDateColumn(key) ? [key, `${key}_local`] : [key]))
}

/** One CSV file: UTF-8 BOM, ";" separator, CRLF lines, money as reais with a comma, ISO dates and a localized column next to them. */
export function toCsv(rows: Row[]): string {
  const columns = csvColumns(rows)
  const lines = [columns.map(csvCell).join(";")]
  for (const row of rows) {
    lines.push(
      columns
        .map((column) => {
          if (column.endsWith("_local") && isDateColumn(column.slice(0, -6))) {
            const raw = row[column.slice(0, -6)]
            return csvCell(typeof raw === "string" ? localizedDate(raw) : "")
          }
          const value = row[column]
          if (isMoneyColumn(column) && typeof value === "number") return csvCell(centsToDecimalComma(value))
          return csvCell(value)
        })
        .join(";")
    )
  }
  return `﻿${lines.join("\r\n")}\r\n`
}
