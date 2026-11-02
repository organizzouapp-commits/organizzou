export type NotificationKind = "info" | "task" | "agenda" | "bill" | "habit" | "workout" | "study" | "goal" | "reminder"

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  /** An app path ("/dashboard/..."), or null. */
  link: string | null
  read_at: string | null
  created_at: string
}
