import { addDays, format, parseISO } from "date-fns"

import type { FlashcardRow } from "./types"

export type Rating = "again" | "good" | "easy"

const QUALITY: Record<Rating, number> = { again: 1, good: 4, easy: 5 }

/** SM-2 (simplified): returns the card with its next interval and due date. */
export function review(card: FlashcardRow, rating: Rating, today: string): FlashcardRow {
  const quality = QUALITY[rating]
  let { ease, interval_days: interval, repetitions } = card

  if (quality < 3) {
    repetitions = 0
    interval = 1
  } else {
    repetitions += 1
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(interval * ease)
    if (rating === "easy") interval = Math.max(interval + 1, Math.round(interval * 1.3))
  }
  ease = Math.max(1.3, Math.round((ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))) * 100) / 100)

  return { ...card, ease, interval_days: interval, repetitions, due_on: format(addDays(parseISO(today), interval), "yyyy-MM-dd") }
}

export function isDue(card: FlashcardRow, today: string) {
  return card.due_on <= today
}

export function daysUntil(day: string, today: string) {
  return Math.round((parseISO(day).getTime() - parseISO(today).getTime()) / 86_400_000)
}
