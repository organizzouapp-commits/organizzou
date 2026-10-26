import type { GoalLinkRow, GoalMilestoneRow } from "./types"

export function linkRatio(link: Pick<GoalLinkRow, "done" | "total">) {
  return link.total <= 0 ? 0 : Math.min(1, link.done / link.total)
}

/** Overall progress (0–100): average of the linked sources, milestones count as one more source. */
export function goalProgress(links: GoalLinkRow[], milestones: GoalMilestoneRow[]) {
  const parts = links.map(linkRatio)
  if (milestones.length > 0) parts.push(milestones.filter((m) => m.done).length / milestones.length)
  if (parts.length === 0) return 0
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
}
