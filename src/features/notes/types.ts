// Mirrors the planned notes and reminders tables (docs/PLAN-PHASE-0.md §4.1).
export type NoteFolderRow = { id: string; user_id: string; name: string }

export type NoteRow = {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  /** Lightweight markdown: "# ", "## ", "- ", "**bold**", "*italic*". Becomes rich-text JSON later. */
  body: string
  pinned: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export type ReminderChannel = "push" | "whatsapp"

export type ReminderRow = {
  id: string
  user_id: string
  title: string
  remind_at: string
  channels: ReminderChannel[]
  status: "pending" | "done"
  note_id: string | null
}
