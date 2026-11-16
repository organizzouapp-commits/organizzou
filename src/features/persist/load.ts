import { EMPTY_SOURCES, type GoalSources } from "@/features/goals/linked"
import { withWaterLogs } from "@/features/habits/water"
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { AccountRow, CategoryRow, FinancialGoalRow, RecurringBillRow, TransactionRow } from "@/features/finance/types"
import type { DeadlineRow, FlashcardDeckRow, FlashcardRow, StudySessionRow, SubjectRow } from "@/features/studies/types"
import type { DietGoalRow, FoodRow, MealItemRow, WeightLogRow } from "@/features/diet/types"
import type { EventRow } from "@/features/calendar/types"
import type { ExerciseRow, PlanExerciseRow, SetLogRow, WorkoutPlanRow, WorkoutSessionRow } from "@/features/workouts/types"
import type { GoalLinkRow, GoalMilestoneRow, GoalWithDetails, LifeGoalRow } from "@/features/goals/types"
import type { HabitLogRow, HabitRow } from "@/features/habits/types"
import type { JournalDay, JournalEntryRow } from "@/features/journal/types"
import type { NoteFolderRow, NoteRow, ReminderRow } from "@/features/notes/types"
import { dayOf } from "@/lib/sp-time"
import { createClient } from "@/lib/supabase/server"

/**
 * Server-side reads for the module screens and the Hoje widgets: the signed-in person's rows, through their own session
 * (RLS decides what exists for them). A table that cannot be read (for example a migration not applied yet) gives an empty list
 * and a log line; the screen then saves nothing silently, because every write reports its own error.
 */
async function client() {
  return (await createClient()) as unknown as SupabaseClient
}

type Query = {
  /** Column to order by, ascending unless `desc`. */
  order?: [column: string, desc?: boolean]
  /** Keep rows whose column is >= this value. */
  since?: [column: string, value: string]
  limit?: number
}

async function rows<T>(supabase: SupabaseClient, table: string, query: Query = {}): Promise<T[]> {
  let request = supabase.from(table).select("*")
  if (query.since) request = request.gte(query.since[0], query.since[1])
  if (query.order) request = request.order(query.order[0], { ascending: !query.order[1] })
  request = request.limit(query.limit ?? 5000)
  const { data, error } = await request
  if (error) {
    console.error(`[data] could not read ${table}: ${error.code ?? ""} ${error.message}`)
    return []
  }
  return (data ?? []) as T[]
}

/** The day `n` days before `now` in São Paulo, "yyyy-MM-dd". */
const back = (now: string, days: number) => dayOf(now, -days)

export async function loadHabits(now: string) {
  const supabase = await client()
  const [habits, logs, water, goal] = await Promise.all([
    rows<HabitRow>(supabase, "habits", { order: ["created_at"] }),
    rows<HabitLogRow>(supabase, "habit_logs", { since: ["log_date", back(now, 400)] }),
    // The water habits read the Dieta water: its log and its goal.
    rows<{ id: string; log_date: string; ml: number }>(supabase, "water_logs", { since: ["log_date", back(now, 400)] }),
    rows<DietGoalRow>(supabase, "diet_goals"),
  ])
  return { habits, logs, water, goal: goal[0] ?? null }
}

export async function loadFinance(now: string) {
  const supabase = await client()
  const [accounts, categories, transactions, bills, goals] = await Promise.all([
    rows<AccountRow>(supabase, "finance_accounts", { order: ["created_at"] }),
    rows<CategoryRow>(supabase, "finance_categories", { order: ["created_at"] }),
    // Opening balances need every movement, so the balance is exact: no date window.
    rows<TransactionRow>(supabase, "finance_transactions", { order: ["occurred_on", true] }),
    rows<RecurringBillRow>(supabase, "finance_bills", { order: ["due_day"] }),
    rows<FinancialGoalRow>(supabase, "finance_goals", { order: ["created_at"] }),
  ])
  void now
  return { accounts, categories, transactions, bills, goals }
}

export async function loadWorkouts(now: string) {
  const supabase = await client()
  const [exercises, plans, planExercises, sessions] = await Promise.all([
    rows<ExerciseRow>(supabase, "exercises", { order: ["name"] }),
    rows<WorkoutPlanRow>(supabase, "workout_plans", { order: ["created_at"] }),
    rows<PlanExerciseRow>(supabase, "plan_exercises", { order: ["position"] }),
    rows<WorkoutSessionRow>(supabase, "workout_sessions", { since: ["performed_on", back(now, 400)], order: ["performed_on", true] }),
  ])
  const setLogs = sessions.length ? await rows<SetLogRow>(supabase, "set_logs", { order: ["set_index"] }) : []
  return { exercises, plans, planExercises, sessions, setLogs }
}

export async function loadDiet(now: string) {
  const supabase = await client()
  const [foods, mealItems, goal, weights, water] = await Promise.all([
    rows<FoodRow>(supabase, "foods", { order: ["name"] }),
    rows<MealItemRow & { log_date: string }>(supabase, "meal_items", { since: ["log_date", back(now, 90)], order: ["created_at"] }),
    rows<DietGoalRow>(supabase, "diet_goals"),
    rows<WeightLogRow>(supabase, "weight_logs", { since: ["log_date", back(now, 400)], order: ["log_date"] }),
    rows<{ id: string; log_date: string; ml: number }>(supabase, "water_logs", { since: ["log_date", back(now, 90)] }),
  ])
  return { foods, mealItems, goal: goal[0] ?? null, weights, water }
}

export async function loadStudies(now: string) {
  const supabase = await client()
  const [subjects, sessions, deadlines, decks, cards] = await Promise.all([
    rows<SubjectRow>(supabase, "subjects", { order: ["created_at"] }),
    rows<StudySessionRow>(supabase, "study_sessions", { since: ["studied_on", back(now, 400)] }),
    rows<DeadlineRow>(supabase, "study_deadlines", { order: ["due_on"] }),
    rows<FlashcardDeckRow>(supabase, "flashcard_decks", { order: ["created_at"] }),
    rows<FlashcardRow>(supabase, "flashcards", { order: ["created_at"] }),
  ])
  return { subjects, sessions, deadlines, decks, cards }
}

export async function loadNotes() {
  const supabase = await client()
  const [folders, notes, reminders] = await Promise.all([
    rows<NoteFolderRow>(supabase, "note_folders", { order: ["name"] }),
    rows<NoteRow>(supabase, "notes", { order: ["updated_at", true] }),
    rows<ReminderRow>(supabase, "reminders", { order: ["remind_at"] }),
  ])
  return { folders, notes, reminders }
}

/**
 * Goals with what feeds them. The progress of a link is LIVE: it is counted from the module's own rows since the goal was created,
 * so it can never drift from reality (nothing is stored for it).
 */
export async function loadGoals() {
  const supabase = await client()
  const [goals, links, milestones] = await Promise.all([
    rows<LifeGoalRow>(supabase, "life_goals", { order: ["created_at"] }),
    rows<GoalLinkRow>(supabase, "life_goal_links", { order: ["created_at"] }),
    rows<GoalMilestoneRow>(supabase, "life_goal_milestones", { order: ["created_at"] }),
  ])
  if (goals.length === 0) return [] as GoalWithDetails[]

  const wanted = new Set(links.map((l) => l.module))
  const earliest = goals.map((g) => g.created_at).sort()[0]
  // Progress counts what HAPPENED since the goal was created, by the date of the event (a study day, a workout day), not by when the row was saved.
  const earliestDay = earliest.slice(0, 10)
  const [doneTasks, habitLogs, saved, sessions, studied, meals, foods, diet] = await Promise.all([
    wanted.has("tarefas") ? rows<{ completed_at: string }>(supabase, "tasks", { since: ["completed_at", earliest] }) : [],
    wanted.has("rotina") ? rows<{ log_date: string }>(supabase, "habit_logs", { since: ["log_date", earliestDay] }) : [],
    wanted.has("financas") ? rows<{ current_cents: number }>(supabase, "finance_goals") : [],
    wanted.has("treinos") ? rows<{ performed_on: string; completed: boolean }>(supabase, "workout_sessions", { since: ["performed_on", earliestDay] }) : [],
    wanted.has("estudos") ? rows<{ studied_on: string; minutes: number }>(supabase, "study_sessions", { since: ["studied_on", earliestDay] }) : [],
    wanted.has("dieta") ? rows<{ log_date: string; food_id: string; servings: number }>(supabase, "meal_items", { since: ["log_date", earliestDay] }) : [],
    wanted.has("dieta") ? rows<FoodRow>(supabase, "foods") : [],
    wanted.has("dieta") ? rows<DietGoalRow>(supabase, "diet_goals") : [],
  ])
  const goalKcal = diet[0]?.kcal ?? 2000

  const live = (link: GoalLinkRow, since: string): number => {
    switch (link.module) {
      case "tarefas":
        return doneTasks.filter((t) => t.completed_at >= since).length
      case "rotina":
        return new Set(habitLogs.filter((l) => l.log_date >= since.slice(0, 10)).map((l) => l.log_date)).size
      case "financas":
        return Math.round(saved.reduce((sum, g) => sum + g.current_cents, 0) / 100)
      case "treinos":
        return sessions.filter((s) => s.completed && s.performed_on >= since.slice(0, 10)).length
      case "estudos":
        return Math.round((studied.filter((s) => s.studied_on >= since.slice(0, 10)).reduce((sum, s) => sum + s.minutes, 0) / 60) * 10) / 10
      case "dieta": {
        const perDay = new Map<string, number>()
        for (const item of meals.filter((m) => m.log_date >= since.slice(0, 10))) {
          const food = foods.find((f) => f.id === item.food_id)
          perDay.set(item.log_date, (perDay.get(item.log_date) ?? 0) + (food ? food.kcal * item.servings : 0))
        }
        return [...perDay.values()].filter((kcal) => kcal <= goalKcal && kcal >= goalKcal * 0.85).length
      }
      default:
        return link.done
    }
  }

  return goals.map((goal) => ({
    ...goal,
    links: links.filter((l) => l.goal_id === goal.id).map((l) => ({ ...l, done: live(l, goal.created_at) })),
    milestones: milestones.filter((m) => m.goal_id === goal.id),
  })) satisfies GoalWithDetails[]
}

/** Check-ins, each with what the other modules saw that day (did the person train? how long did they study?). */
export async function loadJournal(now: string): Promise<JournalDay[]> {
  const supabase = await client()
  const since = back(now, 400)
  const [entries, sessions, studied] = await Promise.all([
    rows<JournalEntryRow>(supabase, "journal_entries", { since: ["entry_date", since], order: ["entry_date", true] }),
    rows<{ performed_on: string; completed: boolean }>(supabase, "workout_sessions", { since: ["performed_on", since] }),
    rows<{ studied_on: string; minutes: number }>(supabase, "study_sessions", { since: ["studied_on", since] }),
  ])
  return entries.map((entry) => ({
    ...entry,
    trained: sessions.some((s) => s.completed && s.performed_on === entry.entry_date),
    studied_min: studied.filter((s) => s.studied_on === entry.entry_date).reduce((sum, s) => sum + s.minutes, 0),
  }))
}

export async function loadEvents() {
  const supabase = await client()
  return { events: await rows<EventRow>(supabase, "events", { order: ["starts_at"] }) }
}

/** Everything the calendar shows: its own events plus dated tasks, workout days and exams/deliveries from the other modules. */
export async function loadAgenda() {
  const supabase = await client()
  const [events, plans, deadlines, boards, tasks] = await Promise.all([
    rows<EventRow>(supabase, "events", { order: ["starts_at"] }),
    rows<WorkoutPlanRow>(supabase, "workout_plans", { order: ["created_at"] }),
    rows<DeadlineRow>(supabase, "study_deadlines", { order: ["due_on"] }),
    rows<{ id: string; name: string }>(supabase, "boards"),
    (async () => {
      const { data, error } = await supabase.from("tasks").select("id, title, due_at, due_has_time, board_id, completed_at").not("due_at", "is", null).limit(2000)
      if (error) console.error(`[data] could not read tasks: ${error.message}`)
      return (data ?? []) as { id: string; title: string; due_at: string; due_has_time: boolean; board_id: string; completed_at: string | null }[]
    })(),
  ])
  const boardName = new Map(boards.map((b) => [b.id, b.name]))
  return {
    events,
    plans,
    deadlines,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, due_at: t.due_at, due_has_time: t.due_has_time, board_id: t.board_id, completed_at: t.completed_at, board_name: boardName.get(t.board_id) ?? "Tarefas" })),
  }
}

/**
 * Everything the Hoje widgets read, in one round of queries (the page asks once per request and the widgets share it).
 * Windows are short on purpose: today, this week, this month, the last streak days.
 */
export async function loadTodaySource(now: string) {
  const supabase = await client()
  const today = dayOf(now)
  const [habits, logs, transactions, bills, categories, foods, mealItems, goal, water, weights, plans, sessions, studySessions, subjects, deadlines, cards, reminders, notes, journal, events] = await Promise.all([
    rows<HabitRow>(supabase, "habits"),
    rows<HabitLogRow>(supabase, "habit_logs", { since: ["log_date", back(now, 400)] }),
    rows<TransactionRow>(supabase, "finance_transactions", { since: ["occurred_on", back(now, 62)] }),
    rows<RecurringBillRow>(supabase, "finance_bills"),
    rows<CategoryRow>(supabase, "finance_categories"),
    rows<FoodRow>(supabase, "foods"),
    rows<MealItemRow>(supabase, "meal_items", { since: ["log_date", today] }),
    rows<DietGoalRow>(supabase, "diet_goals"),
    rows<{ log_date: string; ml: number }>(supabase, "water_logs", { since: ["log_date", today] }),
    rows<WeightLogRow>(supabase, "weight_logs", { since: ["log_date", back(now, 45)], order: ["log_date"] }),
    rows<WorkoutPlanRow>(supabase, "workout_plans"),
    rows<WorkoutSessionRow>(supabase, "workout_sessions", { since: ["performed_on", back(now, 10)] }),
    rows<StudySessionRow>(supabase, "study_sessions", { since: ["studied_on", back(now, 10)] }),
    rows<SubjectRow>(supabase, "subjects"),
    rows<DeadlineRow>(supabase, "study_deadlines", { since: ["due_on", today], order: ["due_on"] }),
    rows<FlashcardRow>(supabase, "flashcards"),
    rows<ReminderRow>(supabase, "reminders", { order: ["remind_at"] }),
    rows<NoteRow>(supabase, "notes", { order: ["updated_at", true], limit: 200 }),
    rows<JournalEntryRow>(supabase, "journal_entries", { since: ["entry_date", back(now, 8)] }),
    rows<EventRow>(supabase, "events", { order: ["starts_at"] }),
  ])
  return {
    habits,
    // A water habit reads the Dieta water (one source): its quantity of today comes from the water log.
    logs: withWaterLogs(habits, logs, water.map((w, index) => ({ id: String(index), log_date: w.log_date, ml: w.ml }))),
    transactions,
    bills,
    categories,
    foods,
    mealItems: mealItems.filter((i) => i.log_date === today),
    goal: goal[0] ?? null,
    waterMl: water.filter((w) => w.log_date === today).reduce((sum, w) => sum + w.ml, 0),
    weights,
    plans,
    sessions,
    studySessions,
    subjects,
    deadlines,
    cards,
    reminders,
    notes,
    journal,
    events,
  }
}

/**
 * The raw rows linked goals are computed from (progress is derived on the client, from the link the person made, so nothing is typed in).
 * Windows are bounded: about a year of habit and study history, the last weeks of food, the current month of spending.
 */
export async function loadGoalSources(now: string): Promise<GoalSources> {
  const supabase = await client()
  const [financeGoals, categories, transactions, habits, habitLogs, waterLogs, subjects, studySessions, workoutSessions, exercises, setLogs, weights, mealItems, foods, diet, tasks, taskTags, boards, lists, tags] = await Promise.all([
    rows<GoalSources["financeGoals"][number]>(supabase, "finance_goals", { order: ["created_at"] }),
    rows<GoalSources["categories"][number]>(supabase, "finance_categories"),
    rows<GoalSources["transactions"][number]>(supabase, "finance_transactions", { since: ["occurred_on", back(now, 62)] }),
    rows<HabitRow>(supabase, "habits", { order: ["created_at"] }),
    rows<HabitLogRow>(supabase, "habit_logs", { since: ["log_date", back(now, 400)] }),
    rows<{ id: string; log_date: string; ml: number }>(supabase, "water_logs", { since: ["log_date", back(now, 400)] }),
    rows<GoalSources["subjects"][number]>(supabase, "subjects"),
    rows<GoalSources["studySessions"][number]>(supabase, "study_sessions", { since: ["studied_on", back(now, 400)] }),
    rows<GoalSources["workoutSessions"][number]>(supabase, "workout_sessions", { since: ["performed_on", back(now, 400)] }),
    rows<GoalSources["exercises"][number]>(supabase, "exercises"),
    rows<GoalSources["setLogs"][number]>(supabase, "set_logs"),
    rows<GoalSources["weights"][number]>(supabase, "weight_logs", { since: ["log_date", back(now, 400)] }),
    rows<{ log_date: string; food_id: string; servings: number }>(supabase, "meal_items", { since: ["log_date", back(now, 14)] }),
    rows<{ id: string; kcal: number }>(supabase, "foods"),
    rows<{ kcal: number }>(supabase, "diet_goals"),
    rows<{ id: string; completed_at: string | null; board_id: string; list_id: string; archived?: boolean }>(supabase, "tasks"),
    rows<{ task_id: string; tag_id: string }>(supabase, "task_tags"),
    rows<GoalSources["boards"][number]>(supabase, "boards"),
    rows<GoalSources["lists"][number]>(supabase, "board_lists"),
    rows<GoalSources["tags"][number]>(supabase, "tags"),
  ])
  const kcalByDay: Record<string, number> = {}
  for (const item of mealItems) {
    const food = foods.find((f) => f.id === item.food_id)
    if (food) kcalByDay[item.log_date] = (kcalByDay[item.log_date] ?? 0) + food.kcal * item.servings
  }
  const tagsOf = new Map<string, string[]>()
  for (const link of taskTags) tagsOf.set(link.task_id, [...(tagsOf.get(link.task_id) ?? []), link.tag_id])
  return {
    ...EMPTY_SOURCES,
    financeGoals,
    categories,
    transactions,
    habits,
    // A water habit reads the Dieta water, like everywhere else.
    habitLogs: withWaterLogs(habits, habitLogs, waterLogs),
    subjects,
    studySessions,
    workoutSessions,
    exercises,
    setLogs,
    weights,
    mealKcalByDay: kcalByDay,
    dietGoalKcal: diet[0]?.kcal ?? 2000,
    tasks: tasks.filter((t) => !t.archived).map((t) => ({ id: t.id, completed_at: t.completed_at, board_id: t.board_id, list_id: t.list_id, tagIds: tagsOf.get(t.id) ?? [] })),
    boards,
    lists,
    tags,
  }
}
