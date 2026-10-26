import type { SwatchId } from "@/lib/swatches"

// Mirrors the planned study tables (docs/PLAN-PHASE-0.md §4.1).
export type SubjectType = "subject" | "course" | "book" | "exam"
export type Priority = "low" | "medium" | "high"

export const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  subject: "Matéria",
  course: "Curso",
  book: "Livro",
  exam: "Concurso / prova",
}

export const PRIORITY_LABELS: Record<Priority, string> = { low: "Baixa", medium: "Média", high: "Alta" }

export type SubjectRow = {
  id: string
  user_id: string
  name: string
  type: SubjectType
  priority: Priority
  swatch: SwatchId
  weekly_goal_min: number
  /** 0–100, for courses and books. */
  progress_pct: number | null
  /** Free text such as "pág. 210 de 464". */
  progress_label: string | null
  created_at: string
  updated_at: string
}

export type StudySessionRow = {
  id: string
  user_id: string
  subject_id: string
  /** "yyyy-MM-dd" in the user's timezone. */
  studied_on: string
  minutes: number
  mode: "pomodoro" | "free"
}

export type DeadlineRow = {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  due_on: string
  kind: "exam" | "delivery"
}

export type FlashcardDeckRow = { id: string; user_id: string; subject_id: string | null; name: string }

export type FlashcardRow = {
  id: string
  deck_id: string
  front: string
  back: string
  /** SM-2 fields. */
  ease: number
  interval_days: number
  repetitions: number
  due_on: string
}
