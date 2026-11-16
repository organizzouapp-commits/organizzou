import type { ModuleId } from "@/components/organizzou/modules"

// Mirrors the planned `life_goals` and `life_goal_links` tables (docs/PLAN-PHASE-0.md §4.1).
export type GoalLinkRow = {
  id: string
  goal_id: string
  /** Module that feeds this part of the progress. */
  module: ModuleId
  label: string
  done: number
  total: number
  /** Shown after the numbers, e.g. "h", "tarefas". Money uses cents with unit "R$". */
  unit: string
  /** Where the numbers come from (a deep link to the module); set for the live rows of a linked goal. */
  href?: string
  /** A spending limit: better the less is used (the bar shows how much of the limit is gone). */
  inverse?: boolean
  /** The thing it measured was deleted. */
  broken?: boolean
}

export type GoalMilestoneRow = { id: string; goal_id: string; title: string; done: boolean }

export type LifeGoalRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  deadline: string | null
  status: "active" | "done"
  created_at: string
  updated_at: string
  /** Only after 20261116000002_goal_links.sql is applied (see link-columns.ts); before it the link is kept on this device. */
  kind?: "free" | "linked"
  link_type?: string | null
  link_id?: string | null
  params?: Record<string, unknown>
  start_date?: string | null
  end_date?: string | null
}

/** Set for goals driven by a module: `virtual` goals are Finanças goals shown here by link (edited in Finanças); `start`/`end` are the goal dates. */
export type GoalLinkInfo = { kind: string; start: string; end: string | null; virtual: boolean }

export type GoalWithDetails = LifeGoalRow & { links: GoalLinkRow[]; milestones: GoalMilestoneRow[]; linked?: GoalLinkInfo }
