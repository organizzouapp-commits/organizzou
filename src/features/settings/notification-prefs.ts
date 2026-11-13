// Notification preferences of the Avisos tab. They are saved in the account (notification_preferences.settings) and mirrored on this device,
// behind a small repository (the localStorage adapter is the fallback until the migration is applied). Pure apart from that adapter.

export const EVENT_KEYS = ["tasks", "agenda", "habits", "bills", "workout", "meals", "study", "summary"] as const
export type EventKey = (typeof EVENT_KEYS)[number]

export type EventPref = { app: boolean; email: boolean }
export type QuietHours = { enabled: boolean; from: string; to: string }
export type NotificationPrefs = { events: Record<EventKey, EventPref>; quiet: QuietHours }

/** Titles, one-line descriptions and the starting choice of each event. */
export const NOTIFICATION_EVENTS: { key: EventKey; label: string; hint: string; app: boolean }[] = [
  { key: "tasks", label: "Tarefas com data", hint: "No dia e 1 hora antes", app: true },
  { key: "agenda", label: "Compromissos da agenda", hint: "Conforme o lembrete de cada evento", app: true },
  { key: "habits", label: "Hábitos do dia", hint: "Resumo no fim da tarde", app: true },
  { key: "bills", label: "Contas a vencer", hint: "3 dias antes e no vencimento", app: true },
  { key: "workout", label: "Horário do treino", hint: "30 minutos antes", app: true },
  { key: "meals", label: "Refeições e água", hint: "Nos horários que você definir", app: false },
  { key: "study", label: "Sessões de estudo e revisões", hint: "Flashcards para revisar", app: true },
  { key: "summary", label: "Resumo matinal e revisão semanal", hint: "Todo dia às 7h30 e domingo às 19h", app: true },
]

export const DEFAULT_QUIET: QuietHours = { enabled: true, from: "22:00", to: "07:00" }

export function defaultPrefs(): NotificationPrefs {
  return {
    events: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.key, { app: e.app, email: false }])) as Record<EventKey, EventPref>,
    quiet: { ...DEFAULT_QUIET },
  }
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/
export const isTime = (value: unknown): value is string => typeof value === "string" && TIME.test(value)

/** Keeps what is valid and fills the rest with the defaults, so an old or hand-edited value never breaks the screen. */
export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const base = defaultPrefs()
  const value = (raw && typeof raw === "object" ? raw : {}) as { events?: Record<string, Partial<EventPref>>; quiet?: Partial<QuietHours> }
  for (const key of EVENT_KEYS) {
    const saved = value.events?.[key]
    if (saved && typeof saved === "object") base.events[key] = { app: typeof saved.app === "boolean" ? saved.app : base.events[key].app, email: typeof saved.email === "boolean" ? saved.email : base.events[key].email }
  }
  const quiet = value.quiet
  if (quiet && typeof quiet === "object") {
    base.quiet = { enabled: typeof quiet.enabled === "boolean" ? quiet.enabled : base.quiet.enabled, from: isTime(quiet.from) ? quiet.from : base.quiet.from, to: isTime(quiet.to) ? quiet.to : base.quiet.to }
  }
  return base
}

export interface NotificationPrefsRepo {
  load(): NotificationPrefs
  save(prefs: NotificationPrefs): void
}

const STORAGE_KEY = "organizzou:avisos"

export function createLocalNotificationPrefsRepo(storage?: Pick<Storage, "getItem" | "setItem">): NotificationPrefsRepo {
  const store = () => storage ?? (typeof localStorage === "undefined" ? null : localStorage)
  return {
    load() {
      try {
        return parseNotificationPrefs(JSON.parse(store()?.getItem(STORAGE_KEY) ?? "null"))
      } catch {
        return defaultPrefs()
      }
    },
    save(prefs) {
      try {
        store()?.setItem(STORAGE_KEY, JSON.stringify(parseNotificationPrefs(prefs)))
      } catch {
        // Private mode: the choice just does not survive the visit.
      }
    },
  }
}

// ---------------------------------------------------------------- times for the picker (15-minute steps)

export const MINUTE_STEP = 15
export const HOURS = Array.from({ length: 24 }, (_, h) => h)
export const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP)

export const pad2 = (n: number) => String(n).padStart(2, "0")

/** "22:30" -> { hour: 22, minute: 30 }; anything invalid is midnight. */
export function splitTime(value: string): { hour: number; minute: number } {
  const match = TIME.exec(value)
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: 0, minute: 0 }
}

export const joinTime = (hour: number, minute: number) => `${pad2(hour)}:${pad2(minute)}`

/** The nearest picker step at or before the minute (a value typed elsewhere, like 22:07, shows as 22:00 in the minute column). */
export const snapMinute = (minute: number) => Math.min(60 - MINUTE_STEP, Math.floor(minute / MINUTE_STEP) * MINUTE_STEP)
