// Reordering the items of a task checklist: the new position of the moved item sits between its new neighbours (positions are
// double precision, so one write per move is enough). Pure.
import { arrayMove } from "@dnd-kit/sortable"

export type Ordered = { id: string; position: number }

const STEP = 1000

/** A position strictly between `before` and `after`; open ends step by 1000. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return STEP
  if (before === undefined) return (after as number) - STEP
  if (after === undefined) return before + STEP
  return (before + after) / 2
}

/** The list after dragging `activeId` onto `overId`, with the moved item's new position; null when nothing changes. */
export function moveChecklistItem<T extends Ordered>(items: T[], activeId: string, overId: string): { items: T[]; moved: { id: string; position: number } } | null {
  const from = items.findIndex((i) => i.id === activeId)
  const to = items.findIndex((i) => i.id === overId)
  if (from < 0 || to < 0 || from === to) return null
  const reordered = arrayMove(items, from, to)
  const position = positionBetween(reordered[to - 1]?.position, reordered[to + 1]?.position)
  return { items: reordered.map((item, index) => (index === to ? { ...item, position } : item)), moved: { id: activeId, position } }
}
