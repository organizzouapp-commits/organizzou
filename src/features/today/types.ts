import type { PanelId, StatId } from "./catalog"

/** Serializable shapes the "Hoje" widgets get from the server. Nothing in here is a function or a component. */

/**
 * "ok": real numbers (or the example data of the prototype, see isMock). "empty": the module works but has nothing to show.
 * "soon": the module has no backend yet. The card says so instead of showing a number.
 */
export type WidgetState = "ok" | "empty" | "soon"

export type StatData = {
  id: StatId
  state: WidgetState
  /** The hero number, already formatted (pt-BR). */
  value: string
  /** One support line. */
  support: string
  /** An arrow icon next to the support line; never a color. */
  trend?: "up" | "down"
  /** 0..100, only when a total exists (a total of 0 never produces a progress). */
  progress?: number
  href: string
  /** What the client needs to keep the card in step with what the person does elsewhere on the page. */
  live?:
    | { kind: "tasks"; pendingIds: string[]; planned: number; doneBefore: number }
    | { kind: "habits"; total: number; doneIds: string[]; scheduledIds: string[] }
    | { kind: "water"; ml: number; goalMl: number }
}

export type DayItemKind = "task" | "event" | "workout" | "study" | "habit" | "bill"

export type DayItem = {
  id: string
  kind: DayItemKind
  title: string
  /** "Tarefas · Trabalho", "Treinos · Academia"... one line. */
  meta: string
  /** ISO instant, or null for items with no time of day. */
  at: string | null
  /** Minutes, shown in the meta line when known. */
  durationMin?: number
  overdue?: boolean
  /** Overdue items: when they were due, so the list can sort the oldest first and say "há 2 dias". */
  overdueSince?: string
  /** Tasks only: "high" gets a flag icon. */
  priority?: "none" | "low" | "medium" | "high"
  /** When it ends (timed items): between `at` and `endAt` the item is "Agora". */
  endAt?: string
  /** Fixed habits with a run of 2+ days: shown with a flame. */
  streak?: number
  /** Bills: the amount (right-aligned) and the due wording. */
  bill?: { amount: string; when: string }
  /** When it was completed (ms since epoch), for "most recent first" in Concluídos. */
  doneAtMs?: number
  /** Tasks only: the real due date, so "adiar" can move it by a day. */
  due?: { at: string; hasTime: boolean }
  href: string
  /** What the one trailing control does: tick a box, add a quantity, go pay, or nothing. */
  action: "check" | "plus" | "pay" | "none"
  done?: boolean
  /** For quantity habits ("+"): today's logged amount, the daily target and its unit. */
  habit?: { qty: number; target: number; unit: string }
}

export type DayData = { state: WidgetState; nowIso: string; items: DayItem[] }

export type NotesData = {
  state: WidgetState
  reminders: { id: string; title: string; at: string }[]
  pinned: { id: string; title: string; preview: string }[]
}

export type FinanceData = { state: WidgetState; surplus: string; surplusTrend: "up" | "down"; budgetPct: number; budgetLine: string }
export type DietData = { state: WidgetState; kcal: number; goalKcal: number; protein: number; waterMl: number; waterGoalMl: number }
export type WorkoutData = { state: WidgetState; title: string | null; time: string | null; weekDone: number; weekPlanned: number }
export type StudyData = { state: WidgetState; studiedMin: number; dailyGoalMin: number; dueCards: number; exam: { title: string; days: number } | null }

export type PanelDataMap = {
  "seu-dia": DayData
  notas: NotesData
  financas: FinanceData
  dieta: DietData
  treino: WorkoutData
  estudos: StudyData
  humor: { state: WidgetState; /** Today's mood (1-5) if the person already checked in. */ mood: number | null }
}

export type PanelDataOf<K extends PanelId> = PanelDataMap[K]
