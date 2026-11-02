import { z } from "zod"

import { SWATCH_IDS } from "@/lib/swatches"

/**
 * Every table the module screens write to, with the exact columns a client may send. The server action validates each row against
 * this (anything not listed is dropped, `user_id` is always the signed-in person, never what the client says) and the client hook
 * uses the same column list to see what changed. Row types in src/features/<module>/types.ts mirror these tables.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const instant = z.iso.datetime({ offset: true })
const text = (max: number) => z.string().max(max)
const name = (max: number) => z.string().trim().min(1).max(max)
const weekdays = z.array(z.number().int().min(0).max(6)).max(7)
const swatch = z.enum(SWATCH_IDS)
const cents = z.number().int().min(0).max(9_000_000_000_000)

type Shape = Record<string, z.ZodType>

export type TableConfig = {
  /** Primary key column: `id`, or `user_id` for the one-row-per-person tables. */
  pk: "id" | "user_id"
  columns: Shape
  schema: z.ZodObject
}

function table(columns: Shape, pk: "id" | "user_id" = "id"): TableConfig {
  const shape = pk === "id" ? { id: z.uuid(), ...columns } : columns
  return { pk, columns, schema: z.object(shape) }
}

export const TABLES = {
  habits: table({
    name: name(120),
    type: z.enum(["fixed", "goal"]),
    target_qty: z.number().positive().max(100000).nullable(),
    unit: text(20).nullable(),
    weekdays,
    deadline: day.nullable(),
    paused: z.boolean(),
  }),
  habit_logs: table({ habit_id: z.uuid(), log_date: day, qty: z.number().min(0).max(100000) }),
  events: table({
    title: name(200),
    starts_at: instant,
    ends_at: instant,
    all_day: z.boolean(),
    description: text(4000).nullable(),
    location: text(300).nullable(),
    category: text(60).nullable(),
    swatch,
    rrule: text(200).nullable(),
    reminder_offsets: z.array(z.number().int().min(0).max(100000)).max(10),
  }),
  finance_accounts: table({ name: name(80), institution: text(80), opening_balance_cents: z.number().int() }),
  finance_categories: table({ name: name(60), icon: text(40).optional(), monthly_limit_cents: cents.nullable() }),
  finance_transactions: table({
    account_id: z.uuid(),
    category_id: z.uuid().nullable(),
    kind: z.enum(["in", "out"]),
    amount_cents: cents.min(1),
    occurred_on: day,
    method: text(60).nullable(),
    description: text(200),
    source: z.enum(["manual", "open_finance"]),
  }),
  finance_bills: table({
    name: name(80),
    amount_cents: cents.min(1),
    due_day: z.number().int().min(1).max(28),
    category_id: z.uuid().nullable(),
    active: z.boolean(),
    last_paid_month: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  }),
  finance_goals: table({ name: name(80), target_cents: cents.min(1), current_cents: cents, deadline: day.nullable() }),
  exercises: table({ name: name(120), muscle_group: text(60) }),
  workout_plans: table({ name: name(80), weekdays }),
  plan_exercises: table({
    plan_id: z.uuid(),
    exercise_id: z.uuid(),
    position: z.number().int().min(0).max(1000),
    sets: z.number().int().min(1).max(20),
    reps: z.number().int().min(1).max(200),
    rest_seconds: z.number().int().min(0).max(1800),
    target_load_kg: z.number().min(0).max(1000).nullable(),
  }),
  workout_sessions: table({ plan_id: z.uuid(), performed_on: day, duration_min: z.number().int().min(0).max(1440).nullable(), completed: z.boolean() }),
  set_logs: table({ session_id: z.uuid(), exercise_id: z.uuid(), set_index: z.number().int().min(0).max(100), reps: z.number().int().min(0).max(1000), load_kg: z.number().min(0).max(1000) }),
  foods: table({ name: name(120), serving_label: name(60), kcal: z.number().min(0).max(10000), protein_g: z.number().min(0).max(1000), carbs_g: z.number().min(0).max(1000), fat_g: z.number().min(0).max(1000) }),
  meal_items: table({ log_date: day.optional(), meal: z.enum(["breakfast", "lunch", "snack", "dinner"]), food_id: z.uuid(), servings: z.number().positive().max(1000) }),
  diet_goals: table(
    { kcal: z.number().int().positive().max(20000), protein_g: z.number().int().min(0).max(2000), carbs_g: z.number().int().min(0).max(2000), fat_g: z.number().int().min(0).max(2000), water_ml: z.number().int().positive().max(20000), target_weight_kg: z.number().positive().max(700).nullable() },
    "user_id"
  ),
  weight_logs: table({ log_date: day, weight_kg: z.number().positive().max(700) }),
  water_logs: table({ log_date: day.optional(), ml: z.number().int().positive().max(5000) }),
  subjects: table({
    name: name(120),
    type: z.enum(["subject", "course", "book", "exam"]),
    priority: z.enum(["low", "medium", "high"]),
    swatch,
    weekly_goal_min: z.number().int().min(0).max(10080),
    progress_pct: z.number().int().min(0).max(100).nullable(),
    progress_label: text(80).nullable(),
  }),
  study_sessions: table({ subject_id: z.uuid(), studied_on: day, minutes: z.number().int().min(1).max(1440), mode: z.enum(["pomodoro", "free"]) }),
  study_deadlines: table({ subject_id: z.uuid().nullable(), title: name(160), due_on: day, kind: z.enum(["exam", "delivery"]) }),
  flashcard_decks: table({ subject_id: z.uuid().nullable(), name: name(120) }),
  flashcards: table({ deck_id: z.uuid(), front: name(2000), back: name(2000), ease: z.number().min(1.3).max(10), interval_days: z.number().int().min(0).max(36500), repetitions: z.number().int().min(0).max(10000), due_on: day }),
  note_folders: table({ name: name(80) }),
  notes: table({ folder_id: z.uuid().nullable(), title: text(200), body: text(100000), pinned: z.boolean(), tags: z.array(z.string().max(40)).max(30) }),
  reminders: table({ title: name(200), remind_at: instant, channels: z.array(z.enum(["push", "whatsapp"])).max(2), status: z.enum(["pending", "done"]), note_id: z.uuid().nullable() }),
  life_goals: table({ title: name(160), description: text(2000).nullable(), deadline: day.nullable(), status: z.enum(["active", "done"]) }),
  life_goal_links: table({ goal_id: z.uuid(), module: name(40), label: name(120), done: z.number().min(0).max(1e12), total: z.number().positive().max(1e12), unit: text(20) }),
  life_goal_milestones: table({ goal_id: z.uuid(), title: name(160), done: z.boolean() }),
  journal_entries: table({ entry_date: day, mood: z.number().int().min(1).max(5), text: text(20000), sleep_hours: z.number().min(0).max(24).nullable() }),
  notification_preferences: table(
    { push_enabled: z.boolean(), whatsapp_enabled: z.boolean(), email_enabled: z.boolean(), daily_summary: z.boolean(), daily_summary_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/) },
    "user_id"
  ),
} satisfies Record<string, TableConfig>

export type TableName = keyof typeof TABLES

export const isTableName = (value: string): value is TableName => Object.prototype.hasOwnProperty.call(TABLES, value)

/** Columns the client compares to decide whether a row changed. */
export const columnsOf = (name: TableName) => Object.keys(TABLES[name].columns)
