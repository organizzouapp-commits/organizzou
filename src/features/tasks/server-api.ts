"use client"

import { createClient } from "@/lib/supabase/client"

import * as actions from "./actions"
import type { BoardApi } from "./board-api"

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80)
}

/** The real backend: server actions + the browser Storage client for attachment uploads. */
export function createServerBoardApi(userId: string): BoardApi {
  return {
    ...actions,
    async uploadAttachment({ taskId, file }) {
      const supabase = createClient()
      const path = `${userId}/${taskId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const { error } = await supabase.storage.from("task-attachments").upload(path, file, {
        contentType: file.type || undefined,
      })
      if (error) return { ok: false, error: `Não consegui enviar ${file.name}.` }

      const result = await actions.registerAttachment({
        taskId,
        storagePath: path,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
      })
      if (!result.ok) await supabase.storage.from("task-attachments").remove([path])
      return result
    },
  }
}
