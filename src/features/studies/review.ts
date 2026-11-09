// Pure helpers of the "Flashcards" tab of Estudos, plus the review history (log) behind the accuracy chart and the review streak.
import { shiftDay } from "@/features/habits/stats"

import { bestStreak, currentStreak } from "./stats"
import type { Rating } from "./spaced-repetition"
import type { FlashcardRow } from "./types"

// ------------------------------------------------------------------ review log

/** One answer given in a review. The card keeps only its next due date, so accuracy and streaks need this history. */
export type ReviewLogEntry = { id: string; card_id: string; deck_id: string; /** "yyyy-MM-dd" in the user's timezone. */ reviewed_on: string; rating: Rating }

/** Where the history lives. Until review_log exists in the database (supabase/migrations/20261110000002_review_log.sql, prepared and NOT applied) it is localStorage. */
export type ReviewLogRepo = {
  load(): ReviewLogEntry[]
  save(entries: ReviewLogEntry[]): void
}

const KEY = "organizzou:estudos-review-log"
/** Old entries beyond this many are dropped: the tab only reads about a year at most. */
const MAX_ENTRIES = 5000
const RATINGS: Rating[] = ["again", "good", "easy"]

export const localReviewLogRepo: ReviewLogRepo = {
  load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.filter((e): e is ReviewLogEntry => Boolean(e) && typeof e.id === "string" && typeof e.card_id === "string" && typeof e.deck_id === "string" && typeof e.reviewed_on === "string" && RATINGS.includes(e.rating))
    } catch {
      return []
    }
  },
  save(entries) {
    try {
      localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
    } catch {
      // Private mode: the history just does not survive the visit.
    }
  },
}

// ------------------------------------------------------------------ accuracy and streak

export type DayAccuracy = { day: string; reviews: number; correct: number; /** 0–100, null when nothing was reviewed that day. */ rate: number | null }

/** A review counts as correct unless it was "Errei". One entry per day of the window (oldest first, ending today). */
export function accuracyByDay(log: ReviewLogEntry[], today: string, days = 7): DayAccuracy[] {
  return Array.from({ length: days }, (_, i) => shiftDay(today, -(days - 1 - i))).map((day) => {
    const entries = log.filter((e) => e.reviewed_on === day)
    const correct = entries.filter((e) => e.rating !== "again").length
    return { day, reviews: entries.length, correct, rate: entries.length === 0 ? null : Math.round((correct / entries.length) * 100) }
  })
}

/** Average accuracy of the window: correct answers over all answers (a busy day weighs more). Null with no reviews. */
export function averageAccuracy(entries: DayAccuracy[]): number | null {
  const reviews = entries.reduce((sum, d) => sum + d.reviews, 0)
  if (reviews === 0) return null
  return Math.round((entries.reduce((sum, d) => sum + d.correct, 0) / reviews) * 100)
}

/** Days with at least one review. */
export const reviewDays = (log: ReviewLogEntry[]) => new Set(log.map((e) => e.reviewed_on))

/** Consecutive days with a review, counted back from today (or yesterday while today is still empty). */
export const reviewStreak = (log: ReviewLogEntry[], today: string) => currentStreak(reviewDays(log), today)

/** The longest run of consecutive review days in the history. */
export const reviewRecord = (log: ReviewLogEntry[]) => bestStreak(reviewDays(log))

// ------------------------------------------------------------------ decks

/** A card whose interval reached this many days counts as mastered. */
export const MASTERED_DAYS = 21

export type DeckStates = { novos: number; aprendendo: number; dominados: number }

/** novos = never reviewed (no repetition, no interval); dominados = interval of 21 days or more; aprendendo = everything in between (a failed card is still learning). */
export function deckStates(cards: Pick<FlashcardRow, "repetitions" | "interval_days">[]): DeckStates {
  const states: DeckStates = { novos: 0, aprendendo: 0, dominados: 0 }
  for (const card of cards) {
    if (card.interval_days >= MASTERED_DAYS) states.dominados += 1
    else if (card.repetitions === 0 && card.interval_days === 0) states.novos += 1
    else states.aprendendo += 1
  }
  return states
}

/** The next day (after today) with a card due, for the "Tudo em dia" message; null when nothing is scheduled. */
export function nextDueDate(cards: Pick<FlashcardRow, "due_on">[], today: string): string | null {
  const later = cards.map((c) => c.due_on).filter((d) => d > today).sort()
  return later[0] ?? null
}

/** The next interval shown under an answer button: "< 1 min", "1 dia", "4 dias", "2 meses", "1 ano". */
export function intervalLabel(days: number): string {
  if (days <= 0) return "< 1 min"
  if (days === 1) return "1 dia"
  if (days < 30) return `${days} dias`
  if (days < 365) {
    const months = Math.round(days / 30)
    return months === 1 ? "1 mês" : `${months} meses`
  }
  const years = Math.round(days / 365)
  return years === 1 ? "1 ano" : `${years} anos`
}
