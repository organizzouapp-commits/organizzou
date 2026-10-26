import type { SwatchId } from "@/lib/swatches"

// Mirrors the planned `events` and `event_reminders` tables (docs/PLAN-PHASE-0.md §4.1).
export type EventRow = {
  id: string
  user_id: string
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
  description: string | null
  location: string | null
  category: string | null
  swatch: SwatchId
  /** Subset of RFC 5545: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, optional BYDAY=MO,TU… */
  rrule: string | null
  /** Minutes before the start; empty means no reminder. */
  reminder_offsets: number[]
  created_at: string
  updated_at: string
}

export type AgendaKind = "event" | "task" | "workout" | "study"

/** One thing on the calendar, whatever module it comes from. */
export type AgendaItem = {
  key: string
  kind: AgendaKind
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  swatch: SwatchId
  detail?: string
  /** Only events created in the Agenda can be edited or deleted there. */
  editable: boolean
}
