// Pure helpers of the "Metas" screen: the summary numbers, the order of the cards and the texts of a goal card.
// Days are "yyyy-MM-dd" strings in America/Sao_Paulo ("today" comes from dayOf(nowIso)); every date calculation uses the date parts alone.
import { daysLeft as daysBetween } from "@/features/studies/deadlines"
import { dayKey } from "@/lib/dates"
import { SP_TIMEZONE } from "@/lib/sp-time"

import { goalProgress } from "./progress"
import type { GoalLinkRow, GoalWithDetails } from "./types"

type Details = Pick<GoalWithDetails, "links" | "milestones">
type Dated = Pick<GoalWithDetails, "id" | "deadline" | "created_at">

/** Whole days from today to the deadline: 0 = today, negative = past. Null without a deadline. */
export function goalDaysLeft(deadline: string | null, today: string): number | null {
  return deadline ? daysBetween(deadline, today) : null
}

/** Average progress (0–100) of the given goals; 0 when there are none. */
export function averageProgress(goals: Details[]): number {
  if (goals.length === 0) return 0
  return Math.round(goals.reduce((sum, g) => sum + goalProgress(g.links, g.milestones), 0) / goals.length)
}

/** The goal with the nearest deadline that has not passed yet (today counts); null when no goal has one. */
export function nextDeadlineGoal<T extends Dated>(goals: T[], today: string): { goal: T; left: number } | null {
  const upcoming = sortGoals(goals.filter((g) => g.deadline && g.deadline >= today))[0]
  return upcoming ? { goal: upcoming, left: goalDaysLeft(upcoming.deadline, today) as number } : null
}

/** Milestones done and total across the given goals. */
export function milestoneTotals(goals: Pick<GoalWithDetails, "milestones">[]): { done: number; total: number } {
  const all = goals.flatMap((g) => g.milestones)
  return { done: all.filter((m) => m.done).length, total: all.length }
}

/**
 * The order of the cards: the nearest deadline first (a past one is the most urgent), then the goals without a deadline.
 * Ties fall back to the creation time and then the id, so the order never changes between renders.
 */
export function sortGoals<T extends Dated>(goals: T[]): T[] {
  return [...goals].sort((a, b) => {
    if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline)
    if (Boolean(a.deadline) !== Boolean(b.deadline)) return a.deadline ? -1 : 1
    return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  })
}

// ------------------------------------------------------------------ text of a card

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** "15 de dez 2026" */
export function formatDeadline(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  return `${d} de ${MONTHS_SHORT[m - 1]} ${y}`
}

/** "faltam 12 dias", "falta 1 dia", "vence hoje", "prazo vencido". */
export function leftLabel(left: number): string {
  if (left < 0) return "prazo vencido"
  if (left === 0) return "vence hoje"
  return left === 1 ? "falta 1 dia" : `faltam ${left} dias`
}

/** The two chips under a goal title: how many days are left and the date. Empty without a deadline (and no countdown once the goal is done). */
export function deadlineChips(deadline: string | null, today: string, active: boolean): string[] {
  if (!deadline) return []
  const left = goalDaysLeft(deadline, today) as number
  return [...(active ? [leftLabel(left)] : []), `até ${formatDeadline(deadline)}`]
}

/** 0–100 for a bar or ring: capped, so 17 of 12 draws a full bar. */
export function cappedPercent(done: number, total: number): number {
  if (!(total > 0) || !(done > 0)) return 0
  return Math.min(100, Math.round((done / total) * 100))
}

/** "R$ 1.200" or "17 tarefas" */
export function formatAmount(value: number, unit: string): string {
  const text = value.toLocaleString("pt-BR")
  return unit === "R$" ? `R$ ${text}` : `${text} ${unit}`
}

/** "17 de 12 tarefas": the real values, even past 100%. The unit is said once for tasks and written on both numbers for money. */
export function linkText(link: Pick<GoalLinkRow, "done" | "total" | "unit">): string {
  return link.unit === "R$" ? `${formatAmount(link.done, "R$")} de ${formatAmount(link.total, "R$")}` : `${link.done.toLocaleString("pt-BR")} de ${formatAmount(link.total, link.unit)}`
}

/** "2 de 3" for the milestones chip. */
export const milestoneChip = (done: number, total: number) => `${done} de ${total}`

// ------------------------------------------------------------------ completed goals

/** What the screen knows beyond `life_goals`: when a goal was completed. Until supabase/migrations/20261110000005_goal_completed_at.sql is applied (prepared, NOT applied) it lives in localStorage. */
export type GoalMeta = { completed_at?: string }
export type GoalMetaMap = Record<string, GoalMeta>
export type GoalMetaRepo = { load(): GoalMetaMap; save(map: GoalMetaMap): void }

const META_KEY = "organizzou:metas-meta"

export const localGoalMetaRepo: GoalMetaRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(META_KEY) ?? "{}") as unknown
      if (!parsed || typeof parsed !== "object") return {}
      const out: GoalMetaMap = {}
      for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
        const at = value && typeof value === "object" ? (value as Record<string, unknown>).completed_at : undefined
        if (typeof at === "string") out[id] = { completed_at: at }
      }
      return out
    } catch {
      return {}
    }
  },
  save(map) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(map))
    } catch {
      // Private mode: the date just does not survive the visit.
    }
  },
}

type Completable = Pick<GoalWithDetails, "id" | "deadline" | "created_at" | "updated_at">
const dayOfIso = (iso: string) => dayKey(iso, SP_TIMEZONE)

/**
 * The day a goal was completed ("yyyy-MM-dd" in São Paulo). `known` is true when the date was recorded at the moment of completion;
 * otherwise the last update of the goal is used, which is when it was closed in nearly every case but is only an estimate.
 */
export function completedOn(goal: Completable, metas: GoalMetaMap): { day: string; known: boolean } {
  const recorded = metas[goal.id]?.completed_at
  return recorded ? { day: dayOfIso(recorded), known: true } : { day: dayOfIso(goal.updated_at), known: false }
}

