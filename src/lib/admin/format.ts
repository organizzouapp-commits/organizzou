/** pt-BR formats for the admin area. Every date is shown in America/Sao_Paulo. */
export const ADMIN_TZ = "America/Sao_Paulo"

const integer = new Intl.NumberFormat("pt-BR")
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: ADMIN_TZ, day: "2-digit", month: "2-digit", year: "numeric" })
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: ADMIN_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

export function fmtInt(value: number | null | undefined) {
  return value == null ? "—" : integer.format(value)
}

export function fmtPct(ratio: number | null | undefined) {
  return ratio == null || !Number.isFinite(ratio) ? "—" : percent.format(ratio)
}

/** dd/MM/yyyy */
export function fmtDate(value: string | Date | null | undefined) {
  return value ? date.format(new Date(value)) : "—"
}

/** dd/MM/yyyy HH:mm */
export function fmtDateTime(value: string | Date | null | undefined) {
  return value ? dateTime.format(new Date(value)).replace(",", "") : "—"
}

/** "2026-01-05" (a plain SQL date) -> "05/01". */
export function fmtDayMonth(day: string) {
  const [, month, d] = day.split("-")
  return `${d}/${month}`
}

/** Plain SQL date "2026-01-05" -> dd/MM/yyyy, without a time zone shift. */
export function fmtSqlDate(day: string | null | undefined) {
  if (!day) return "—"
  const [y, m, d] = day.split("-")
  return `${d}/${m}/${y}`
}

export type Variation = { diff: number; ratio: number | null }

/** Change against the previous period. `null` when there is no honest base to compare with. */
export function variation(current: number | null | undefined, previous: number | null | undefined): Variation | null {
  if (current == null || previous == null) return null
  return { diff: current - previous, ratio: previous > 0 ? (current - previous) / previous : null }
}

/** One CSV cell. Cells that start with = + - @ are prefixed with ' so a spreadsheet never runs them as formulas. */
export function csvCell(value: string | number | boolean | null | undefined) {
  let text = value == null ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]) {
  // UTF-8 BOM so Excel opens accents correctly; ";" is the pt-BR Excel separator.
  return String.fromCharCode(0xfeff) + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n"
}

/** Whole days from now until `iso` (negative when it already passed). Kept here so pages stay pure. */
export function daysUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 86_400_000
}
