// Which subjects are archived. `subjects` has no column for it yet (supabase/migrations/20261110000100_subjects_archived.sql is prepared,
// NOT applied), so the ids live in localStorage behind the interface a Supabase adapter will implement.
export type SubjectMeta = { archived: string[] }

export type SubjectMetaRepo = {
  load(): SubjectMeta
  save(meta: SubjectMeta): void
}

const KEY = "organizzou:estudos-subject-meta"

export function parseSubjectMeta(raw: unknown): SubjectMeta {
  const value = (raw && typeof raw === "object" ? raw : {}) as { archived?: unknown }
  return { archived: Array.isArray(value.archived) ? [...new Set(value.archived.filter((id): id is string => typeof id === "string"))] : [] }
}

/** Archives or restores one subject (returns a new object). */
export function setArchived(meta: SubjectMeta, id: string, archived: boolean): SubjectMeta {
  const rest = meta.archived.filter((x) => x !== id)
  return { archived: archived ? [...rest, id] : rest }
}

export const localSubjectMetaRepo: SubjectMetaRepo = {
  load() {
    try {
      return parseSubjectMeta(JSON.parse(localStorage.getItem(KEY) ?? "null"))
    } catch {
      return { archived: [] }
    }
  },
  save(meta) {
    try {
      localStorage.setItem(KEY, JSON.stringify(parseSubjectMeta(meta)))
    } catch {
      // Private mode: the change just does not survive the visit.
    }
  },
}
