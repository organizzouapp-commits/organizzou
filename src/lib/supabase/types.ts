// TEMPORARY hand-written types that mirror supabase/migrations. Overwrite with the generated file:
//   npx supabase gen types typescript --linked > src/lib/supabase/types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: []
}

type Stamps = { created_at: string; updated_at: string }

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string
          display_name: string | null
          timezone: string
          locale: string
          theme: string
          onboarding: Json
        } & Stamps,
        "id"
      >
      tags: Table<{ id: string; user_id: string; name: string; swatch: string } & Stamps, "user_id" | "name">
      attachments: Table<
        {
          id: string
          user_id: string
          entity_type: string
          entity_id: string
          storage_path: string
          file_name: string
          mime_type: string | null
          size_bytes: number | null
        } & Stamps,
        "user_id" | "entity_type" | "entity_id" | "storage_path" | "file_name"
      >
      audit_log: Table<
        {
          id: string
          user_id: string
          actor: string
          action: string
          entity_type: string | null
          entity_id: string | null
          payload: Json
          confirmed_at: string | null
        } & Stamps,
        "user_id" | "actor" | "action"
      >
      boards: Table<
        { id: string; user_id: string; name: string; position: number; archived: boolean } & Stamps,
        "user_id" | "name"
      >
      board_lists: Table<
        {
          id: string
          user_id: string
          board_id: string
          name: string
          position: number
          is_done_list: boolean
        } & Stamps,
        "user_id" | "board_id" | "name"
      >
      tasks: Table<
        {
          id: string
          user_id: string
          board_id: string
          list_id: string
          title: string
          description: string | null
          priority: string
          due_at: string | null
          due_has_time: boolean
          category: string | null
          swatch: string
          position: number
          completed_at: string | null
          archived: boolean
        } & Stamps,
        "user_id" | "board_id" | "list_id" | "title"
      >
      task_checklist_items: Table<
        { id: string; user_id: string; task_id: string; text: string; done: boolean; position: number } & Stamps,
        "user_id" | "task_id" | "text"
      >
      task_comments: Table<
        { id: string; user_id: string; task_id: string; body: string } & Stamps,
        "user_id" | "task_id" | "body"
      >
      task_tags: Table<
        { id: string; user_id: string; task_id: string; tag_id: string } & Stamps,
        "user_id" | "task_id" | "tag_id"
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      reorder_tasks: { Args: { p_list_id: string; p_task_ids: string[] }; Returns: undefined }
      reorder_lists: { Args: { p_board_id: string; p_list_ids: string[] }; Returns: undefined }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
