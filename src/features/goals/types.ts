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
}

export type GoalWithDetails = LifeGoalRow & { links: GoalLinkRow[]; milestones: GoalMilestoneRow[] }
