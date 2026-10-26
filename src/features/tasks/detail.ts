import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

import type { TaskDetail } from "./types"

export async function queryTaskDetail(
  supabase: SupabaseClient<Database>,
  taskId: string
): Promise<TaskDetail | null> {
  const [checklist, comments, attachments] = await Promise.all([
    supabase.from("task_checklist_items").select("*").eq("task_id", taskId).order("position"),
    supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
    supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", "task")
      .eq("entity_id", taskId)
      .order("created_at"),
  ])
  if (checklist.error || comments.error || attachments.error) return null

  return {
    checklist: checklist.data,
    comments: comments.data,
    attachments: attachments.data,
  }
}
