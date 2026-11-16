// How a goal's link to module data is stored: in the new life_goals columns (20261116000002_goal_links.sql, PREPARED, not applied) when the
// database has them, and in localStorage (LinkedGoalRepo, "organizzou:metas-links") otherwise. Both are written on every save; when
// reading, the database wins and the device fills in the goals the database does not know as linked. Pure.
import { parseSpec, type LinkedGoalMap, type LinkedGoalMeta } from "./linked"
import type { LifeGoalRow } from "./types"

export type LinkColumns = Pick<LifeGoalRow, "kind" | "link_type" | "link_id" | "params" | "start_date" | "end_date">

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^\d{4}-\d{2}-\d{2}$/

/** The columns for a goal: a free goal (no link) or a linked one, with the whole link kept in `params`. */
export function linkToColumns(meta: LinkedGoalMeta | undefined): LinkColumns {
  if (!meta) return { kind: "free", link_type: null, link_id: null, params: {}, start_date: null, end_date: null }
  const spec = meta.spec as Record<string, unknown>
  // The one thing a link points at that is a row of its own (a savings goal, a habit, a subject...) is also kept as link_id when it is a uuid.
  const target = [spec.goalId, spec.categoryId, spec.habitId, spec.subjectId, spec.exerciseId, spec.scopeId].find((v) => typeof v === "string" && UUID.test(v as string))
  return { kind: "linked", link_type: meta.spec.kind, link_id: (target as string | undefined) ?? null, params: { ...meta.spec }, start_date: meta.startDate, end_date: meta.endDate }
}

/** The link stored in a goal's columns, or undefined for a free goal, a row from before the migration, or columns that do not parse. */
export function linkFromRow(row: Partial<LinkColumns>): LinkedGoalMeta | undefined {
  if (row.kind !== "linked" || !row.params || typeof row.params !== "object") return undefined
  const spec = parseSpec(row.params as Record<string, unknown>)
  if (!spec || typeof row.start_date !== "string" || !ISO.test(row.start_date)) return undefined
  return { spec, startDate: row.start_date, endDate: typeof row.end_date === "string" && ISO.test(row.end_date) ? row.end_date : null }
}

/** The links in force: what the database says, and for the goals it does not know as linked, what this device remembers. */
export function mergeLinks(rows: { id: string; kind?: LinkColumns["kind"]; params?: LinkColumns["params"]; start_date?: string | null; end_date?: string | null }[], local: LinkedGoalMap): LinkedGoalMap {
  const out: LinkedGoalMap = {}
  for (const row of rows) {
    const fromDb = linkFromRow(row)
    const fromDevice = local[row.id]
    if (fromDb) out[row.id] = fromDb
    else if (fromDevice) out[row.id] = fromDevice
  }
  return out
}
